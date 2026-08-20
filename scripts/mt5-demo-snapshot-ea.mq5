#property strict

input string ApiUrl = "https://qhpokqaxb234i7pk7ubxjmywkq0nugeq.lambda-url.ap-southeast-2.on.aws/api/mt4/snapshot";
// Leave blank if the Lambda does not require x-api-key.
input string ApiKey = "";
input string AccountId = "demo-account";
input string TerminalId = "mt5-terminal-1";
input string ServerName = "";
input string SymbolsCsv = "AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADJPY,EURAUD,EURCAD,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPNZD,GBPUSD,NZDJPY,USDCAD,USDCHF,USDJPY";
input int HistoryBars = 120;
input int TimerSeconds = 1;
input int SnapshotCooldownSeconds = 5;
input int SenderLeaseSeconds = 30;
input int FailureBackoffSeconds = 15;

int gHeartbeat = 0;
string gSnapshotThrottleKey = "market-analysis:mt5-snapshot:last-post";
string gSnapshotSenderKey = "market-analysis:mt5-snapshot:sender";
string gSnapshotFailureKey = "market-analysis:mt5-snapshot:last-failure";
bool gIsSender = false;

string Trim(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
   return value;
}

string IsoTimestamp(datetime timeValue)
{
   MqlDateTime parts;
   TimeToStruct(timeValue, parts);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ", parts.year, parts.mon, parts.day, parts.hour, parts.min, parts.sec);
}

string JsonEscape(string value)
{
   string output = value;
   StringReplace(output, "\\", "\\\\");
   StringReplace(output, "\"", "\\\"");
   return output;
}

string QuoteValue(double value, int digits)
{
   if (!MathIsValidNumber(value))
   {
      value = 0.0;
   }

   return DoubleToString(value, MathMax(0, digits));
}

double SafeNumber(double value)
{
   if (!MathIsValidNumber(value))
   {
      return 0.0;
   }

   return value;
}

string EffectiveAccountId()
{
   if (AccountId != "")
   {
      return AccountId;
   }

   return IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN));
}

string EffectiveTerminalId()
{
   if (TerminalId != "")
   {
      return TerminalId;
   }

   return StringFormat("%s-%I64d", TerminalInfoString(TERMINAL_NAME), AccountInfoInteger(ACCOUNT_LOGIN));
}

bool TryClaimSnapshotSlot()
{
   datetime now = TimeGMT();

   if (!GlobalVariableCheck(gSnapshotThrottleKey))
   {
      GlobalVariableSet(gSnapshotThrottleKey, 0.0);
   }

   double previous = GlobalVariableGet(gSnapshotThrottleKey);
   if ((now - previous) < SnapshotCooldownSeconds)
   {
      return false;
   }

   return GlobalVariableSetOnCondition(gSnapshotThrottleKey, (double)now, previous);
}

bool IsInFailureBackoff()
{
   if (!GlobalVariableCheck(gSnapshotFailureKey))
   {
      return false;
   }

   datetime now = TimeGMT();
   double lastFailure = GlobalVariableGet(gSnapshotFailureKey);
   return (now - lastFailure) < FailureBackoffSeconds;
}

void MarkSnapshotFailure()
{
   GlobalVariableSet(gSnapshotFailureKey, (double)TimeGMT());
}

bool TryBecomeSender()
{
   double now = (double)TimeGMT();
   double owner = 0.0;

   if (!GlobalVariableCheck(gSnapshotSenderKey))
   {
      GlobalVariableSet(gSnapshotSenderKey, 0.0);
   }

   owner = GlobalVariableGet(gSnapshotSenderKey);
   if (owner == 0.0)
   {
      return GlobalVariableSetOnCondition(gSnapshotSenderKey, (double)ChartID(), 0.0);
   }

   if (owner == (double)ChartID())
   {
      GlobalVariableSet(gSnapshotSenderKey, (double)ChartID());
      return true;
   }

   string ownerKey = StringFormat("%s:heartbeat:%.0f", gSnapshotSenderKey, owner);
   if (GlobalVariableCheck(ownerKey))
   {
      double lastBeat = GlobalVariableGet(ownerKey);
      if ((now - lastBeat) > SenderLeaseSeconds)
      {
         return GlobalVariableSetOnCondition(gSnapshotSenderKey, (double)ChartID(), owner);
      }
   }

   return false;
}

void RefreshSenderLease()
{
   if (!gIsSender)
   {
      return;
   }

   GlobalVariableSet(gSnapshotSenderKey, (double)ChartID());
   GlobalVariableSet(StringFormat("%s:heartbeat:%.0f", gSnapshotSenderKey, (double)ChartID()), (double)TimeGMT());
}

bool GetSymbolQuote(string symbol, double &bid, double &ask, int &digits)
{
   string requested = Trim(symbol);
   string resolved = requested;

   if (!SymbolSelect(resolved, true))
   {
      // Some brokers add suffixes/prefixes (for example EURUSDm). Try to find a close match.
      int total = SymbolsTotal(true);
      for (int index = 0; index < total; index++)
      {
         string candidate = SymbolName(index, true);
         string candidateUpper = StringToUpper(candidate);
         string requestedUpper = StringToUpper(requested);

         if (candidateUpper == requestedUpper || StringFind(candidateUpper, requestedUpper) == 0)
         {
            resolved = candidate;
            if (SymbolSelect(resolved, true))
            {
               break;
            }
         }
      }
   }

   if (!SymbolSelect(resolved, true))
   {
      return false;
   }

   if (!SymbolInfoDouble(resolved, SYMBOL_BID, bid))
   {
      return false;
   }

   if (!SymbolInfoDouble(resolved, SYMBOL_ASK, ask))
   {
      return false;
   }

   if (bid <= 0 || ask <= 0)
   {
      return false;
   }

   digits = (int)SymbolInfoInteger(resolved, SYMBOL_DIGITS);
   return true;
}

string BuildQuotesJson(string symbolsCsv)
{
   string parts[];
   int count = StringSplit(symbolsCsv, ',', parts);
   string json = "[";

   for (int index = 0; index < count; index++)
   {
      string symbol = Trim(parts[index]);
      if (symbol == "")
      {
         continue;
      }

      double bid = 0.0;
      double ask = 0.0;
      int digits = 5;
      if (!GetSymbolQuote(symbol, bid, ask, digits))
      {
         continue;
      }

      if (StringLen(json) > 1)
      {
         json += ",";
      }

      json += StringFormat(
         "{\"symbol\":\"%s\",\"bid\":%s,\"ask\":%s,\"timestamp\":\"%s\"}",
         JsonEscape(symbol),
         QuoteValue(bid, digits),
         QuoteValue(ask, digits),
         IsoTimestamp(TimeGMT())
      );
   }

   json += "]";
   return json;
}

string ResolveHistorySymbol(string requested)
{
   string resolved = Trim(requested);
   if (SymbolSelect(resolved, true))
   {
      return resolved;
   }

   int total = SymbolsTotal(true);
   string requestedUpper = StringToUpper(resolved);
   for (int index = 0; index < total; index++)
   {
      string candidate = SymbolName(index, true);
      string candidateUpper = StringToUpper(candidate);
      if (candidateUpper == requestedUpper || StringFind(candidateUpper, requestedUpper) == 0)
      {
         if (SymbolSelect(candidate, true))
         {
            return candidate;
         }
      }
   }

   return "";
}

string BuildHistoryFrameJson(string symbol, ENUM_TIMEFRAMES timeframe)
{
   string resolved = ResolveHistorySymbol(symbol);
   if (resolved == "")
   {
      return "[]";
   }

   MqlRates rates[];
   int copied = CopyRates(resolved, timeframe, 1, MathMax(30, HistoryBars), rates);
   if (copied <= 0)
   {
      return "[]";
   }

   string json = "[";
   for (int index = 0; index < copied; index++)
   {
      if (index > 0)
      {
         json += ",";
      }

      json += StringFormat(
         "{\"t\":%I64d,\"o\":%s,\"h\":%s,\"l\":%s,\"c\":%s,\"v\":%s}",
         (long)rates[index].time * 1000,
         QuoteValue(rates[index].open, 8),
         QuoteValue(rates[index].high, 8),
         QuoteValue(rates[index].low, 8),
         QuoteValue(rates[index].close, 8),
         QuoteValue((double)rates[index].tick_volume, 0)
      );
   }

   json += "]";
   return json;
}

string BuildHistoryJson(string symbolsCsv)
{
   string parts[];
   int count = StringSplit(symbolsCsv, ',', parts);
   string json = "{";
   bool hasSymbol = false;

   for (int index = 0; index < count; index++)
   {
      string symbol = Trim(parts[index]);
      if (symbol == "")
      {
         continue;
      }

      if (hasSymbol)
      {
         json += ",";
      }
      hasSymbol = true;
      json += StringFormat(
         "\"%s\":{\"1hour\":%s,\"4hour\":%s,\"1Day\":%s,\"1Week\":%s}",
         JsonEscape(symbol),
         BuildHistoryFrameJson(symbol, PERIOD_H1),
         BuildHistoryFrameJson(symbol, PERIOD_H4),
         BuildHistoryFrameJson(symbol, PERIOD_D1),
         BuildHistoryFrameJson(symbol, PERIOD_W1)
      );
   }

   json += "}";
   return json;
}

string BuildPayload()
{
   gHeartbeat++;
   string payload = "{";
   payload += StringFormat("\"accountId\":\"%s\",", JsonEscape(EffectiveAccountId()));
   payload += StringFormat("\"terminalId\":\"%s\",", JsonEscape(EffectiveTerminalId()));
   payload += StringFormat("\"timestamp\":\"%s\",", IsoTimestamp(TimeGMT()));
   payload += StringFormat("\"heartbeat\":%d,", gHeartbeat);
   payload += StringFormat("\"balance\":%s,", DoubleToString(SafeNumber(AccountInfoDouble(ACCOUNT_BALANCE)), 2));
   payload += StringFormat("\"equity\":%s,", DoubleToString(SafeNumber(AccountInfoDouble(ACCOUNT_EQUITY)), 2));
   payload += StringFormat("\"margin\":%s,", DoubleToString(SafeNumber(AccountInfoDouble(ACCOUNT_MARGIN)), 2));
   payload += StringFormat("\"freeMargin\":%s,", DoubleToString(SafeNumber(AccountInfoDouble(ACCOUNT_MARGIN_FREE)), 2));
   payload += StringFormat("\"quotes\":%s,", BuildQuotesJson(SymbolsCsv));
   payload += StringFormat("\"history\":%s", BuildHistoryJson(SymbolsCsv));
   payload += "}";

   return payload;
}

bool PostSnapshot()
{
   if (!gIsSender)
   {
      Print("MT5 snapshot skipped: this chart is not the sender");
      return false;
   }

   if (IsInFailureBackoff())
   {
      Print("MT5 snapshot skipped: waiting after a recent failed post");
      return false;
   }

   if (!TryClaimSnapshotSlot())
   {
      Print("MT5 snapshot skipped: another chart posted recently");
      return false;
   }

   string body = BuildPayload();
   PrintFormat("MT5 snapshot payload=%s", body);
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   if (ApiKey != "")
   {
      headers += StringFormat("x-api-key: %s\r\n", ApiKey);
   }

   char data[];
   char result[];
   string resultHeaders = "";

   int dataSize = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if (dataSize <= 1)
   {
      Print("MT5 snapshot failed: empty payload");
      return false;
   }

   if (data[dataSize - 1] == 0)
   {
      ArrayResize(data, dataSize - 1);
   }
   int timeoutMs = 5000;
   ResetLastError();

   int status = WebRequest("POST", ApiUrl, headers, timeoutMs, data, result, resultHeaders);
   if (status == -1)
   {
      MarkSnapshotFailure();
      PrintFormat("MT5 snapshot failed: %d", GetLastError());
      return false;
   }

   string response = CharArrayToString(result, 0, -1, CP_UTF8);
   PrintFormat("MT5 snapshot status=%d response=%s", status, response);
   if (status == 429)
   {
      MarkSnapshotFailure();
   }

   return status >= 200 && status < 300;
}

int OnInit()
{
   if (!GlobalVariableCheck(gSnapshotThrottleKey))
   {
      GlobalVariableSet(gSnapshotThrottleKey, 0.0);
   }

   if (!GlobalVariableCheck(gSnapshotFailureKey))
   {
      GlobalVariableSet(gSnapshotFailureKey, 0.0);
   }

   gIsSender = TryBecomeSender();
   if (!gIsSender)
   {
      Print("MT5 snapshot skipped: sender lock is held by another chart");
      return INIT_SUCCEEDED;
   }

   RefreshSenderLease();

   EventSetTimer(MathMax(1, TimerSeconds));
   PostSnapshot();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();

   if (gIsSender)
   {
      string heartbeatKey = StringFormat("%s:heartbeat:%.0f", gSnapshotSenderKey, (double)ChartID());
      if (GlobalVariableCheck(heartbeatKey))
      {
         GlobalVariableDel(heartbeatKey);
      }

      if (GlobalVariableCheck(gSnapshotSenderKey) && GlobalVariableGet(gSnapshotSenderKey) == (double)ChartID())
      {
         GlobalVariableSet(gSnapshotSenderKey, 0.0);
      }
   }

   if (GlobalVariableCheck(gSnapshotFailureKey))
   {
      GlobalVariableDel(gSnapshotFailureKey);
   }
}

void OnTimer()
{
   RefreshSenderLease();
   PostSnapshot();
}

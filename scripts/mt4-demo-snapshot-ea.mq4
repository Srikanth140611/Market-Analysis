#property strict

input string ApiUrl = "https://qhpokqaxb234i7pk7ubxjmywkq0nugeq.lambda-url.ap-southeast-2.on.aws/api/mt4/snapshot";
input string ApiKey = "";
input string AccountId = "demo-account";
input string TerminalId = "mt4-terminal-1";
input string ServerName = "";
input string SymbolsCsv = "EURUSD,GBPUSD,USDJPY";
input int TimerSeconds = 1;

int gHeartbeat = 0;

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

string QuoteValue(double value)
{
   return DoubleToString(value, Digits);
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

      double bid = MarketInfo(symbol, MODE_BID);
      double ask = MarketInfo(symbol, MODE_ASK);
      if (bid <= 0 || ask <= 0)
      {
         continue;
      }

      if (StringLen(json) > 1)
      {
         json += ",";
      }

      json += StringFormat(
         "{\"symbol\":\"%s\",\"bid\":%s,\"ask\":%s,\"spread\":%s,\"timestamp\":\"%s\"}",
         JsonEscape(symbol),
         QuoteValue(bid),
         QuoteValue(ask),
         QuoteValue(ask - bid),
         IsoTimestamp(TimeGMT())
      );
   }

   json += "]";
   return json;
}

string BuildPositionsJson()
{
   string json = "[";
   int total = OrdersTotal();

   for (int index = 0; index < total; index++)
   {
      if (!OrderSelect(index, SELECT_BY_POS, MODE_TRADES))
      {
         continue;
      }

      int orderType = OrderType();
      if (orderType != OP_BUY && orderType != OP_SELL)
      {
         continue;
      }

      if (StringLen(json) > 1)
      {
         json += ",";
      }

      string side = orderType == OP_BUY ? "BUY" : "SELL";
      json += StringFormat(
         "{\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%s,\"openPrice\":%s,\"profit\":%s",
         JsonEscape(OrderSymbol()),
         side,
         DoubleToString(OrderLots(), 2),
         DoubleToString(OrderOpenPrice(), Digits),
         DoubleToString(OrderProfit() + OrderSwap() + OrderCommission(), 2)
      );

      if (OrderStopLoss() > 0)
      {
         json += StringFormat(",\"stopLoss\":%s", DoubleToString(OrderStopLoss(), Digits));
      }

      if (OrderTakeProfit() > 0)
      {
         json += StringFormat(",\"takeProfit\":%s", DoubleToString(OrderTakeProfit(), Digits));
      }

      json += "}";
   }

   json += "]";
   return json;
}

string BuildPendingOrdersJson()
{
   string json = "[";
   int total = OrdersTotal();

   for (int index = 0; index < total; index++)
   {
      if (!OrderSelect(index, SELECT_BY_POS, MODE_TRADES))
      {
         continue;
      }

      int orderType = OrderType();
      string typeLabel = "";
      if (orderType == OP_BUYLIMIT)
      {
         typeLabel = "BUY_LIMIT";
      }
      else if (orderType == OP_BUYSTOP)
      {
         typeLabel = "BUY_STOP";
      }
      else if (orderType == OP_SELLLIMIT)
      {
         typeLabel = "SELL_LIMIT";
      }
      else if (orderType == OP_SELLSTOP)
      {
         typeLabel = "SELL_STOP";
      }

      if (typeLabel == "")
      {
         continue;
      }

      if (StringLen(json) > 1)
      {
         json += ",";
      }

      json += StringFormat(
         "{\"symbol\":\"%s\",\"type\":\"%s\",\"price\":%s,\"volume\":%s",
         JsonEscape(OrderSymbol()),
         typeLabel,
         DoubleToString(OrderOpenPrice(), Digits),
         DoubleToString(OrderLots(), 2)
      );

      if (OrderStopLoss() > 0)
      {
         json += StringFormat(",\"stopLoss\":%s", DoubleToString(OrderStopLoss(), Digits));
      }

      if (OrderTakeProfit() > 0)
      {
         json += StringFormat(",\"takeProfit\":%s", DoubleToString(OrderTakeProfit(), Digits));
      }

      json += "}";
   }

   json += "]";
   return json;
}

string BuildPayload()
{
   gHeartbeat++;
   string payload = "{";
   payload += StringFormat("\"accountId\":\"%s\",", JsonEscape(AccountId));
   payload += StringFormat("\"terminalId\":\"%s\",", JsonEscape(TerminalId));

   if (ServerName != "")
   {
      payload += StringFormat("\"server\":\"%s\",", JsonEscape(ServerName));
   }

   payload += StringFormat("\"timestamp\":\"%s\",", IsoTimestamp(TimeGMT()));
   payload += StringFormat("\"heartbeat\":%d,", gHeartbeat);
   payload += StringFormat("\"balance\":%s,", DoubleToString(AccountBalance(), 2));
   payload += StringFormat("\"equity\":%s,", DoubleToString(AccountEquity(), 2));
   payload += StringFormat("\"margin\":%s,", DoubleToString(AccountMargin(), 2));
   payload += StringFormat("\"freeMargin\":%s,", DoubleToString(AccountFreeMargin(), 2));
   payload += StringFormat("\"positions\":%s,", BuildPositionsJson());
   payload += StringFormat("\"pendingOrders\":%s,", BuildPendingOrdersJson());
   payload += StringFormat("\"quotes\":%s", BuildQuotesJson(SymbolsCsv));
   payload += "}";

   return payload;
}

bool PostSnapshot()
{
   string body = BuildPayload();
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   if (ApiKey != "")
   {
      headers += StringFormat("x-api-key: %s\r\n", ApiKey);
   }

   char data[];
   char result[];
   string resultHeaders = "";

   StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   int timeoutMs = 5000;
   ResetLastError();

   int status = WebRequest("POST", ApiUrl, headers, timeoutMs, data, result, resultHeaders);
   if (status == -1)
   {
      PrintFormat("MT4 snapshot failed: %d", GetLastError());
      return false;
   }

   string response = CharArrayToString(result, 0, -1, CP_UTF8);
   PrintFormat("MT4 snapshot status=%d response=%s", status, response);
   return status >= 200 && status < 300;
}

int OnInit()
{
   EventSetTimer(MathMax(1, TimerSeconds));
   PostSnapshot();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PostSnapshot();
}
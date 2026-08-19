import { Platform } from "react-native";

function defaultApiBaseUrl() {
	if (Platform.OS === "web") {
		if (typeof window !== "undefined" && window.location.hostname === "localhost") {
			return "http://localhost:8080";
		}

		// Hosted web deployments should call the deployed HTTPS API by default.
		return process.env.EXPO_PUBLIC_PROD_API_BASE_URL ?? "https://qhpokqaxb234i7pk7ubxjmywkq0nugeq.lambda-url.ap-southeast-2.on.aws";
	}

	if (Platform.OS === "android") {
		// Android emulator maps host machine localhost to 10.0.2.2
		return "http://10.0.2.2:8080";
	}

	return "http://localhost:8080";
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl();
export const API_BASE_URL_CANDIDATES = Array.from(
	new Set(
		[
			process.env.EXPO_PUBLIC_API_BASE_URL,
			process.env.EXPO_PUBLIC_PROD_API_BASE_URL,
			defaultApiBaseUrl(),
			"https://qhpokqaxb234i7pk7ubxjmywkq0nugeq.lambda-url.ap-southeast-2.on.aws",
			"",
			"http://localhost:8080",
			"http://10.0.2.2:8080"
		].filter((value): value is string => Boolean(value))
	)
);
export const REFRESH_INTERVAL_MS = 15_000;

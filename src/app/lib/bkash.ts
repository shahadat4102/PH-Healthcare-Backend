import config from "../config";
import { redisClient } from "./redis";

const BKASH_ID_TOKEN_KEY = "bkash:idToken";
const BKASH_REFRESH_TOKEN_KEY = "bkash:refreshToken";

export const getBkashIdToken = async (): Promise<string> => {
	try {
		let bkashIdToken = await redisClient.get(BKASH_ID_TOKEN_KEY);
		const bkashIdTokenTTL = await redisClient.ttl(BKASH_ID_TOKEN_KEY);

		const bkashRefreshToken = await redisClient.get(BKASH_REFRESH_TOKEN_KEY);
		const bkashRefreshTokenTTL = await redisClient.ttl(BKASH_REFRESH_TOKEN_KEY);

		// Refresh token flow
		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
			const refreshResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);

			if (!refreshResponse.ok) {
				throw new Error("bKash token refresh failed");
			}

			const refreshResult = await refreshResponse.json();
			bkashIdToken = refreshResult.id_token as string;

			await redisClient.set(BKASH_ID_TOKEN_KEY, bkashIdToken, {
				expiration: { type: "EX", value: 60 * 60 },
			});

			return bkashIdToken;
		}

		// ID token still valid
		if (bkashIdTokenTTL > 600 && bkashIdToken) {
			return bkashIdToken;
		}

		// Grant token flow
		const grantResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		if (!grantResponse.ok) {
			throw new Error("bKash token grant failed");
		}

		const grantResult = await grantResponse.json();

		await redisClient.set(BKASH_ID_TOKEN_KEY, grantResult.id_token, {
			expiration: { type: "EX", value: 60 * 60 }, // 1 hour
		});

		await redisClient.set(BKASH_REFRESH_TOKEN_KEY, grantResult.refresh_token, {
			expiration: { type: "EX", value: 60 * 60 * 24 * 28 }, // 28 days
		});

		return grantResult.id_token as string;
	} catch (error: any) {
		throw new Error(error.message);
	}
};

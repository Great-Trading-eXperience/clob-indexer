export const ORDER_STATUS = ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED", "EXPIRED"];

export const TIME_INTERVALS = {
	minute: 60,
	fiveMinutes: 300,
	thirtyMinutes: 1800,
	hour: 3600,
	day: 86400,
};

export enum OrderSide {
	BUY = "Buy",
	SELL = "Sell",
}

export enum OrderType {
	MARKET = "Market",
	LIMIT = "Limit",
}

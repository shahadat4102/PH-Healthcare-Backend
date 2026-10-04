import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import z from "zod";

export const validateReqest = (zodschema: z.ZodTypeAny) => {
	return catchAsync(
		(req: Request, res: Response, next: NextFunction) => {
			const payload = req.body ?? {};

			const result = zodschema.safeParse(payload);

			if (!result.success) {
				throw new Error(result.error.issues[0].message);
			}

			req.body = result.data;
			next();
		},
	);
};

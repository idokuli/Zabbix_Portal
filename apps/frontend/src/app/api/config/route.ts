import { NextResponse } from "next/server";

export const GET = () =>
  NextResponse.json({
    refreshInterval: Number(process.env.REFRESH_INTERVAL ?? 10),
  });

import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "../../../lib/utils/stack";

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code is required" },
        { status: 400 },
      );
    }

    // Exchange the authorization code for tokens using StackAuth
    const tokens = await stackServerApp.exchangeCodeForTokens(code);

    if (!tokens.refreshToken) {
      return NextResponse.json(
        { error: "No refresh token received from StackAuth" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      state,
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to exchange authorization code" },
      { status: 500 },
    );
  }
}

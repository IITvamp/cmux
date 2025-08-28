import { stackServerApp } from "@/lib/utils/stack";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code is required" },
        { status: 400 },
      );
    }

    // Exchange authorization code for tokens using StackAuth
    const tokens = await stackServerApp.exchangeCodeForTokens(code, {
      state,
    });

    if (!tokens) {
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 400 },
      );
    }

    if (!tokens.refreshToken) {
      return NextResponse.json(
        { error: "No refresh token received from StackAuth" },
        { status: 500 },
      );
    }

    // Return the refresh token to the client
    return NextResponse.json({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
    });

    if (!tokens) {
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 400 },
      );
    }

    // Return the refresh token to the client
    return NextResponse.json({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = await request.json();
    const { email, reference, orderId } = body;

    if (!email || !orderId) {
      return NextResponse.json(
        { error: "Email and order ID are required." },
        { status: 400 },
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, paymentMethod: "PAYSTACK", isPaid: false },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Payable order not found." },
        { status: 404 },
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: "PAYSTACK_SECRET_KEY is not configured." },
        { status: 500 },
      );
    }

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(order.total * 100),
          currency: "NGN",
          reference: reference || `hishop_${Date.now()}`,
          metadata: {
            orderId: orderId || "manual_order",
            source: "hishop",
          },
        }),
      },
    );

    const responseData = await paystackResponse.json();

    if (!paystackResponse.ok || !responseData.status) {
      return NextResponse.json(
        { error: responseData.message || "Paystack initialization failed." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: responseData.data,
    });
  } catch (error) {
    console.error("Paystack initialize error:", error);
    return NextResponse.json(
      { error: "Unable to initialize Paystack payment." },
      { status: 500 },
    );
  }
}

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
    const { reference, orderId } = body;

    if (!reference || !orderId) {
      return NextResponse.json(
        { error: "A payment reference and order ID are required." },
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

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const responseData = await response.json();

    if (
      !response.ok ||
      !responseData.status ||
      responseData.data.status !== "success"
    ) {
      return NextResponse.json(
        { error: responseData.message || "Payment verification failed." },
        { status: 400 },
      );
    }

    if (
      responseData.data.metadata?.orderId !== orderId ||
      Number(responseData.data.amount) !== Math.round(order.total * 100)
    ) {
      return NextResponse.json(
        { error: "The verified payment does not match this order." },
        { status: 400 },
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        isPaid: true,
        paymentReference: reference,
        paidAt: new Date(),
        status: "PROCESSING",
      },
    });

    return NextResponse.json({
      success: true,
      data: responseData.data,
    });
  } catch (error) {
    console.error("Paystack verify error:", error);
    return NextResponse.json(
      { error: "Unable to verify Paystack payment." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const scope = new URL(request.url).searchParams.get("scope");

    if (scope === "store") {
      const store = await prisma.store.findUnique({ where: { userId } });

      if (!store) {
        return NextResponse.json(
          { error: "Store not found." },
          { status: 404 },
        );
      }

      const orders = await prisma.order.findMany({
        where: { storeId: store.id },
        include: {
          user: true,
          address: true,
          orderItems: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ orders });
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        address: true,
        orderItems: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in to place an order." },
        { status: 401 },
      );
    }

    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return NextResponse.json(
        { error: "Your account needs an email address." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { address, items, coupon, paymentMethod = "PAY_ON_DELIVERY" } = body;

    if (!items?.length || items.some((item) => !item.productId)) {
      return NextResponse.json(
        { error: "Missing cart items." },
        { status: 400 },
      );
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: { id: true, price: true, storeId: true },
    });

    if (products.length !== new Set(items.map((item) => item.productId)).size) {
      return NextResponse.json(
        { error: "One or more products are unavailable." },
        { status: 400 },
      );
    }

    const storeIds = new Set(products.map((product) => product.storeId));

    if (storeIds.size !== 1) {
      return NextResponse.json(
        { error: "Please order products from one store at a time." },
        { status: 400 },
      );
    }

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const orderItems = items.map((item) => ({
      productId: item.productId,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      price: productById.get(item.productId).price,
    }));
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    let discountPercent = 0;

    if (coupon?.code) {
      const savedCoupon = await prisma.coupon.findUnique({
        where: { code: coupon.code },
      });
      if (!savedCoupon || savedCoupon.expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Coupon code is invalid or expired." },
          { status: 400 },
        );
      }
      discountPercent = savedCoupon.discount;
    }

    const total = subtotal - (subtotal * discountPercent) / 100;
    const payment =
      paymentMethod === "PAYSTACK" ? "PAYSTACK" : "PAY_ON_DELIVERY";
    const profileName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ");

    const order = await prisma.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: userId },
        update: {
          name: profileName || email,
          email,
          image: clerkUser.imageUrl || "",
        },
        create: {
          id: userId,
          name: profileName || email,
          email,
          image: clerkUser.imageUrl || "",
        },
      });

      const savedAddress = await transaction.address.create({
        data: {
          userId,
          name: address?.name || profileName || email,
          email: address?.email || email,
          street: address?.street || "",
          city: address?.city || "",
          state: address?.state || "",
          zip: address?.zip || "",
          country: address?.country || "Nigeria",
          phone: address?.phone || "",
        },
      });

      return transaction.order.create({
        data: {
          total,
          userId,
          storeId: [...storeIds][0],
          addressId: savedAddress.id,
          isPaid: false,
          paymentMethod: payment,
          isCouponUsed: discountPercent > 0,
          coupon: coupon?.code
            ? { code: coupon.code, discount: discountPercent }
            : {},
          orderItems: {
            create: orderItems,
          },
        },
        include: {
          orderItems: { include: { product: true } },
          address: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const { orderId, status } = await request.json();
    const allowedStatuses = [
      "ORDER_PLACED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
    ];

    if (!orderId || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid order or status." },
        { status: 400 },
      );
    }

    const store = await prisma.store.findUnique({ where: { userId } });

    if (!store) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }

    const result = await prisma.order.updateMany({
      where: { id: orderId, storeId: store.id },
      data: { status },
    });

    if (!result.count) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        address: true,
        orderItems: { include: { product: true } },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Update order status error:", error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 },
    );
  }
}

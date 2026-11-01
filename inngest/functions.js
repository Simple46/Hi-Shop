import { inngest } from "./client";

export const hishopStoreCreated = inngest.createFunction(
  {
    id: "hishop-store-created",
    triggers: [{ event: "store/created" }],
  },
  async ({ event, step }) => {
    const store = event.data?.store ?? {};
    const storeName = store.name ?? "New store";
    const storeEmail = store.email ?? "store@example.com";

    await step.run("notify-store-owner", async () => {
      console.log(`HiShop: new store created -> ${storeName} (${storeEmail})`);
    });

    return {
      ok: true,
      message: `${storeName} has been added to HiShop.`,
      store: {
        id: store.id ?? null,
        name: storeName,
        email: storeEmail,
      },
    };
  },
);

export const hishopOrderCreated = inngest.createFunction(
  {
    id: "hishop-order-created",
    triggers: [{ event: "order/created" }],
  },
  async ({ event, step }) => {
    const order = event.data?.order ?? {};
    const customerName = order.customerName ?? "Customer";
    const total = Number(order.total ?? 0);

    await step.run("record-order-alert", async () => {
      console.log(
        `HiShop: new order received for ${customerName} - ₦${total.toLocaleString()}`,
      );
    });

    return {
      ok: true,
      message: `Order received for ${customerName}.`,
      orderTotal: total,
    };
  },
);

export const functions = [hishopStoreCreated, hishopOrderCreated];

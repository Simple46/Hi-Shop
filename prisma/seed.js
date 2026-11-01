import prisma from "../lib/prisma.js";

const storeId = "hishop_demo_store";
const ownerId = "hishop_demo_store_owner";

const demoProducts = [
  {
    id: "prod_1",
    name: "Modern table lamp",
    mrp: 40,
    price: 29,
    category: "Decoration",
  },
  {
    id: "prod_2",
    name: "Smart speaker gray",
    mrp: 50,
    price: 29,
    category: "Speakers",
  },
  {
    id: "prod_3",
    name: "Smart watch white",
    mrp: 60,
    price: 29,
    category: "Watch",
  },
  {
    id: "prod_4",
    name: "Wireless headphones",
    mrp: 70,
    price: 29,
    category: "Headphones",
  },
  {
    id: "prod_5",
    name: "Smart watch black",
    mrp: 49,
    price: 29,
    category: "Watch",
  },
  {
    id: "prod_6",
    name: "Security Camera",
    mrp: 59,
    price: 29,
    category: "Camera",
  },
  {
    id: "prod_7",
    name: "Smart Pen for iPad",
    mrp: 89,
    price: 29,
    category: "Pen",
  },
  {
    id: "prod_8",
    name: "Home Theater",
    mrp: 99,
    price: 29,
    category: "Theater",
  },
  {
    id: "prod_9",
    name: "Apple Wireless Earbuds",
    mrp: 89,
    price: 29,
    category: "Earbuds",
  },
  {
    id: "prod_10",
    name: "Apple Smart Watch",
    mrp: 179,
    price: 29,
    category: "Watch",
  },
  {
    id: "prod_11",
    name: "RGB Gaming Mouse",
    mrp: 39,
    price: 29,
    category: "Mouse",
  },
  {
    id: "prod_12",
    name: "Smart Home Cleaner",
    mrp: 199,
    price: 29,
    category: "Cleaner",
  },
];

try {
  await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      name: "HiShop Demo Store",
      email: "demo-store@hishop.local",
      image: "",
    },
  });

  await prisma.store.upsert({
    where: { id: storeId },
    update: {},
    create: {
      id: storeId,
      userId: ownerId,
      name: "HiShop Demo Store",
      description: "Demo catalog for local checkout testing.",
      username: "hishop-demo-seed",
      address: "Nigeria",
      status: "approved",
      isActive: true,
      logo: "",
      email: "demo-store@hishop.local",
      contact: "",
    },
  });

  for (const product of demoProducts) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: {
        ...product,
        description: `${product.name} demo catalog item.`,
        images: [],
        storeId,
      },
    });
  }

  console.log(`Seeded ${demoProducts.length} demo products.`);
} finally {
  await prisma.$disconnect();
}

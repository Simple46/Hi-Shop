"use client";
import PageTitle from "@/components/PageTitle";
import { useEffect, useState } from "react";
import OrderItem from "@/components/OrderItem";
import Loading from "@/components/Loading";
import { useUser } from "@clerk/nextjs";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setError("Sign in to view your orders.");
      setLoading(false);
      return;
    }

    fetch("/api/orders")
      .then(async (response) => {
        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          if (response.redirected) {
            throw new Error(
              "Your session may have expired. Please sign in again.",
            );
          }
          throw new Error(
            `Orders API returned a non-JSON response (HTTP ${response.status}). Check the server terminal for details.`,
          );
        }

        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to load orders.");
        setOrders(result.orders || []);
      })
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  if (loading) return <Loading />;

  return (
    <div className="min-h-[70vh] mx-6">
      {error && (
        <p className="mx-auto mt-12 max-w-7xl text-center text-red-600">
          {error}
        </p>
      )}
      {orders.length > 0 ? (
        <div className="my-20 max-w-7xl mx-auto">
          <PageTitle
            heading="My Orders"
            text={`Showing total ${orders.length} orders`}
            linkText={"Go to home"}
          />

          <table className="w-full max-w-5xl text-slate-500 table-auto border-separate border-spacing-y-12 border-spacing-x-4">
            <thead>
              <tr className="max-sm:text-sm text-slate-600 max-md:hidden">
                <th className="text-left">Product</th>
                <th className="text-center">Total Price</th>
                <th className="text-left">Address</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderItem order={order} key={order.id} />
              ))}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
          <h1 className="text-2xl sm:text-4xl font-semibold">
            You have no orders
          </h1>
        </div>
      ) : null}
    </div>
  );
}

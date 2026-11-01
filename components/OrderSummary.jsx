import { PlusIcon, SquarePenIcon, XIcon } from 'lucide-react';
import React, { useEffect, useState } from "react";
import AddressModal from './AddressModal';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { couponDummyData } from "@/assets/assets";
import { useUser } from "@clerk/nextjs";

const OrderSummary = ({ totalPrice, items }) => {

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "₦";
    const router = useRouter();
    const { isLoaded, isSignedIn } = useUser();
    const addressList = useSelector(state => state.address.list);

    const [paymentMethod, setPaymentMethod] = useState("Pay on Delivery");
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [coupon, setCoupon] = useState('');

    useEffect(() => {
      if (addressList?.length > 0 && !selectedAddress) {
        setSelectedAddress(addressList[0]);
      }
    }, [addressList, selectedAddress]);

    const handleCouponCode = async (event) => {
      event.preventDefault();

      const normalizedCode = couponCodeInput.trim().toUpperCase();
      const matchedCoupon = couponDummyData.find(
        (item) => item.code.toUpperCase() === normalizedCode,
      );

      if (!matchedCoupon) {
        toast.error("Coupon code is invalid or expired.");
        return;
      }

      setCoupon(matchedCoupon);
      toast.success(`${matchedCoupon.code} applied successfully.`);
    };

    const loadPaystackScript = () => {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
          reject(new Error("Window not available"));
          return;
        }

        if (window.PaystackPop) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Paystack script could not be loaded."));
        document.body.appendChild(script);
      });
    };

    const handlePlaceOrder = async (e) => {
      e.preventDefault();

      if (!selectedAddress) {
        toast.error("Please choose or add a delivery address first.");
        return;
      }

      if (!isLoaded || !isSignedIn) {
        toast.error("Please sign in before placing your order.");
        return;
      }

      let createdOrder;

      try {
        const orderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: selectedAddress,
            items: items.map((item) => ({
              productId: item.id,
              quantity: item.quantity || 1,
            })),
            coupon,
            paymentMethod:
              paymentMethod === "Paystack" ? "PAYSTACK" : "PAY_ON_DELIVERY",
          }),
        });
        const orderResult = await orderResponse.json();
        if (!orderResponse.ok)
          throw new Error(orderResult.error || "Unable to create order.");
        createdOrder = orderResult.order;
      } catch (error) {
        toast.error(error.message || "Unable to place order.");
        return;
      }

      if (paymentMethod === "Paystack") {
        try {
          const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

          if (!publicKey) {
            toast.error(
              "Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to your .env before using Paystack.",
            );
            return;
          }

          const initializeResponse = await fetch("/api/paystack/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: selectedAddress.email || "customer@hishop.com",
              orderId: createdOrder.id,
              reference: `hishop_${Date.now()}`,
            }),
          });

          const initializeData = await initializeResponse.json();

          if (!initializeResponse.ok) {
            throw new Error(
              initializeData.error || "Paystack initialization failed.",
            );
          }

          await loadPaystackScript();
          const paystack = window.PaystackPop.setup({
            key: publicKey,
            email: selectedAddress.email || "customer@hishop.com",
            amount: initializeData.data.amount,
            currency: "NGN",
            ref: initializeData.data.reference,
            callback: async function (response) {
              const verifyResponse = await fetch("/api/paystack/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  reference: response.reference,
                  orderId: createdOrder.id,
                }),
              });

              const verifyData = await verifyResponse.json();

              if (!verifyResponse.ok) {
                toast.error(verifyData.error || "Payment verification failed.");
                return;
              }

              toast.success(`Payment successful: ${response.reference}`);
              router.push("/orders");
            },
            onClose: function () {
              toast("Payment window closed. You can try again anytime.");
            },
          });
          paystack.openIframe();
          return;
        } catch (error) {
          toast.error(
            error.message || "Paystack payment could not be started.",
          );
          return;
        }
      }

      toast.success("Order placed successfully with Pay on Delivery.");
      router.push("/orders");
    };

    const discountedTotal = coupon
      ? totalPrice - (coupon.discount / 100) * totalPrice
      : totalPrice;

    return (
      <div className="w-full max-w-lg lg:max-w-[340px] bg-slate-50/30 border border-slate-200 text-slate-500 text-sm rounded-xl p-7">
        <h2 className="text-xl font-medium text-slate-600">Payment Summary</h2>
        <p className="text-slate-400 text-xs my-4">Payment Method</p>
        <div className="flex gap-2 items-center">
          <input
            type="radio"
            id="PAYSTACK"
            name="payment"
            onChange={() => setPaymentMethod("Paystack")}
            checked={paymentMethod === "Paystack"}
            className="accent-gray-500"
          />
          <label htmlFor="PAYSTACK" className="cursor-pointer">
            Paystack
          </label>
        </div>
        <div className="flex gap-2 items-center mt-1">
          <input
            type="radio"
            id="PAY_ON_DELIVERY"
            name="payment"
            onChange={() => setPaymentMethod("Pay on Delivery")}
            checked={paymentMethod === "Pay on Delivery"}
            className="accent-gray-500"
          />
          <label htmlFor="PAY_ON_DELIVERY" className="cursor-pointer">
            Pay on Delivery
          </label>
        </div>
        <div className="my-4 py-4 border-y border-slate-200 text-slate-400">
          <p>Address</p>
          {selectedAddress ? (
            <div className="flex gap-2 items-center">
              <p>
                {selectedAddress.name}, {selectedAddress.city},{" "}
                {selectedAddress.state}, {selectedAddress.zip}
              </p>
              <SquarePenIcon
                onClick={() => setSelectedAddress(null)}
                className="cursor-pointer"
                size={18}
              />
            </div>
          ) : (
            <div>
              {addressList.length > 0 && (
                <select
                  className="border border-slate-400 p-2 w-full my-3 outline-none rounded"
                  onChange={(e) =>
                    setSelectedAddress(addressList[e.target.value])
                  }
                >
                  <option value="">Select Address</option>
                  {addressList.map((address, index) => (
                    <option key={index} value={index}>
                      {address.name}, {address.city}, {address.state},{" "}
                      {address.zip}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="flex items-center gap-1 text-slate-600 mt-1"
                onClick={() => setShowAddressModal(true)}
              >
                Add Address <PlusIcon size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="pb-4 border-b border-slate-200">
          <div className="flex justify-between">
            <div className="flex flex-col gap-1 text-slate-400">
              <p>Subtotal:</p>
              <p>Shipping:</p>
              {coupon && <p>Coupon:</p>}
            </div>
            <div className="flex flex-col gap-1 font-medium text-right">
              <p>
                {currency}
                {totalPrice.toLocaleString()}
              </p>
              <p>Free</p>
              {coupon && (
                <p>{`-${currency}${((coupon.discount / 100) * totalPrice).toFixed(2)}`}</p>
              )}
            </div>
          </div>
          {!coupon ? (
            <form
              onSubmit={handleCouponCode}
              className="flex justify-center gap-3 mt-3"
            >
              <input
                onChange={(e) => setCouponCodeInput(e.target.value)}
                value={couponCodeInput}
                type="text"
                placeholder="Coupon Code"
                className="border border-slate-400 p-1.5 rounded w-full outline-none"
              />
              <button
                type="submit"
                className="bg-slate-600 text-white px-3 rounded hover:bg-slate-800 active:scale-95 transition-all"
              >
                Apply
              </button>
            </form>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 text-xs mt-2">
              <p>
                Code:{" "}
                <span className="font-semibold ml-1">
                  {coupon.code.toUpperCase()}
                </span>
              </p>
              <p>{coupon.description}</p>
              <XIcon
                size={18}
                onClick={() => setCoupon("")}
                className="hover:text-red-700 transition cursor-pointer"
              />
            </div>
          )}
        </div>
        <div className="flex justify-between py-4">
          <p>Total:</p>
          <p className="font-medium text-right">
            {currency}
            {discountedTotal.toFixed(2).toLocaleString()}
          </p>
        </div>
        <button
          onClick={(e) =>
            toast.promise(handlePlaceOrder(e), { loading: "placing Order..." })
          }
          className="w-full bg-slate-700 text-white py-2.5 rounded hover:bg-slate-900 active:scale-95 transition-all"
        >
          Place Order
        </button>

        {showAddressModal && (
          <AddressModal setShowAddressModal={setShowAddressModal} />
        )}
      </div>
    );
}

export default OrderSummary
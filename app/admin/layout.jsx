import AdminLayout from "@/components/admin/AdminLayout";

export const metadata = {
  title: "HiShop. - Admin",
  description: "HiShop. - Admin",
};

export default function RootAdminLayout({ children }) {

    return (
        <>
            <AdminLayout>
                {children}
            </AdminLayout>
        </>
    );
}

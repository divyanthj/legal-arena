import { Suspense } from "react";
import HeaderBlog from "./_assets/components/HeaderBlog";

export default async function LayoutBlog({ children }) {
  return (
    <div className="arena-landing min-h-screen bg-[#020202] text-white">
      <Suspense>
        <HeaderBlog />
      </Suspense>

      <main className="arena-column-bg min-h-screen">{children}</main>
    </div>
  );
}

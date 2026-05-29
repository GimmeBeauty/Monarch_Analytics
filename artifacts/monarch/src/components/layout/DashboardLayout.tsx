import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  hideDatePicker?: boolean;
}

export default function DashboardLayout({ children, title, description, hideDatePicker }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FFF9F2] dark:bg-[#120d06]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} description={description} hideDatePicker={hideDatePicker} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

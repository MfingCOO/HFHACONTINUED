'use server';
import { CoachDashboardClient } from "@/components/coach/dashboard/coach-dashboard-client";
import { getClientsForCoach } from "@/app/coach/dashboard/actions";
import { ClientProfile } from "@/types";

// This is now a Server Component. It fetches data on the server and passes it down.
export default async function CoachDashboardPage() {
    
    const { data: initialClients } = await getClientsForCoach();

    return (
       <CoachDashboardClient initialClients={initialClients || []} />
    )
}

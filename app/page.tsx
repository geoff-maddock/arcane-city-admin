import Link from "next/link";
import { Upload, CalendarSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventQueue } from "@/components/EventQueue";

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage events for{" "}
            <a
              href="https://arcane.city"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              arcane.city
            </a>
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Link>
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/upload">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Upload Flyer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload event flyers — Claude will extract details and prepare the API request
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/events">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarSearch className="h-4 w-4 text-primary" />
                Find & Edit Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search existing events to add info, photos, or update details
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Live queue */}
      <EventQueue />
    </div>
  );
}

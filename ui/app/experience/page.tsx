import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ExperiencePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <h1 className="text-4xl font-bold mb-4">Experience</h1>
      <p className="text-xl text-muted-foreground mb-12">
        Interactive resume showcasing roles and technical demonstrations
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Roles</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Title</CardTitle>
              <CardDescription>
                Company Name • Start Date - End Date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Brief description of the role and key responsibilities...
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Key achievement or responsibility</li>
                <li>Key achievement or responsibility</li>
                <li>Key achievement or responsibility</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-12" />

      <section>
        <h2 className="text-2xl font-semibold mb-6">
          Interactive Demonstrations
        </h2>
        <p className="text-muted-foreground mb-6">
          This section will contain embedded interactive visualizations (Leaflet
          maps, D3.js charts, etc.)
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Visualization Example 1</CardTitle>
              <CardDescription>Leaflet map or D3.js chart</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded-md flex items-center justify-center">
                <p className="text-muted-foreground">
                  Placeholder for interactive component
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visualization Example 2</CardTitle>
              <CardDescription>
                Data visualization or interactive demo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded-md flex items-center justify-center">
                <p className="text-muted-foreground">
                  Placeholder for interactive component
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

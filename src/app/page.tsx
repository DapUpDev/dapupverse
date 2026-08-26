import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <Badge variant="secondary">Milestone 1</Badge>
          <CardTitle className="text-3xl font-semibold tracking-tight">
            DapUp
          </CardTitle>
          <CardDescription className="text-base">
            Frontend scaffold is live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The product interface — mentor discovery, connections, and
            messaging — will be implemented in the next milestone.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

import { getTeamMembers } from "@/data/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Team members</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mirrors <code className="rounded bg-muted px-1 font-mono text-xs">organization_members</code> — invite
          flows and SCIM land here later.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Organization</CardTitle>
          <CardDescription>Roles: owner → admin → member → viewer</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-6 text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId} className="border-border/60">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                          {initials(m.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{m.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

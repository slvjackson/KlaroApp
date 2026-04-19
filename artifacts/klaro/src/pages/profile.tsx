import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Mail, User } from "lucide-react";

export default function Profile() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: user } = useGetMe();

  if (isAuthLoading) return null;

  const profile = user?.businessProfile as Record<string, string> | null | undefined;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">Informações da sua conta</p>
        </div>

        <Card className="bg-card border-border max-w-lg">
          <CardHeader>
            <CardTitle className="text-white text-base">Dados da conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0" style={{ borderRadius: "8px" }}>
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
                <p className="text-sm text-white font-medium">{user?.name ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0" style={{ borderRadius: "8px" }}>
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="text-sm text-white font-medium">{user?.email ?? "—"}</p>
              </div>
            </div>

            {profile?.segment && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0" style={{ borderRadius: "8px" }}>
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Segmento</p>
                  <p className="text-sm text-white font-medium">{profile.segment}</p>
                </div>
              </div>
            )}

            {profile?.businessName && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0" style={{ borderRadius: "8px" }}>
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Nome do negócio</p>
                  <p className="text-sm text-white font-medium">{profile.businessName}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

import { getUsageStats } from "@/lib/usage-analytics";
import { loadAllSkills } from "@/lib/skills-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Eye, Calendar, AlertCircle } from "lucide-react";

export default async function AnalyticsPage() {
  const stats = await getUsageStats();
  const skills = await loadAllSkills();
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  const totalEvents = stats.reduce((sum, s) => sum + s.totalUses, 0);
  const unusedSkills = skills.filter((s) => !stats.find((st) => st.skillId === s.id));
  const recentlyUsed = stats.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skill Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Usage insights parsed from sessions, logs, and dashboard activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Total Usage Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalEvents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Skills with Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.length}</div>
            <div className="text-xs text-muted-foreground">of {skills.length} total</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Unused Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{unusedSkills.length}</div>
            <div className="text-xs text-muted-foreground">candidates for cleanup</div>
          </CardContent>
        </Card>
      </div>

      {recentlyUsed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Most Used Skills
          </h2>
          <div className="space-y-2">
            {recentlyUsed.map((stat) => {
              const skill = skillMap.get(stat.skillId);
              return (
                <Card key={stat.skillId}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {skill?.frontmatter.name || stat.skillName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last used: {stat.lastUsed.slice(0, 10)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {Object.entries(stat.bySource).map(([source, count]) => (
                            <Badge key={source} variant="secondary" className="text-[10px]">
                              {source}: {count}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-sm font-semibold w-8 text-right">
                          {stat.totalUses}
                        </div>
                      </div>
                    </div>
                    {stat.timeline.length > 1 && (
                      <div className="mt-2 flex items-end gap-0.5 h-8">
                        {stat.timeline.slice(-14).map((t, i) => {
                          const max = Math.max(...stat.timeline.map((x) => x.count));
                          const h = max > 0 ? (t.count / max) * 100 : 0;
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-primary/30 rounded-sm min-w-[2px]"
                              style={{ height: `${h}%` }}
                              title={`${t.date}: ${t.count}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {unusedSkills.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Unused Skills
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unusedSkills.map((skill) => (
              <Card key={skill.id} className="opacity-60">
                <CardContent className="py-3 px-4">
                  <div className="font-medium text-sm">
                    {skill.frontmatter.name || "Unnamed Skill"}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {skill.frontmatter.description || "No description."}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

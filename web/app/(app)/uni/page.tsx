"use client";

import { AreaTasksCard, Columns, Loading, PageTitle } from "@/components/Cards";
import { useData } from "@/components/DataProvider";
import { useCalendar } from "@/components/useCalendar";
import { CoursesCard } from "@/components/uni/Courses";
import { PriorityCard, StudyPlanCard } from "@/components/uni/Priority";
import { SyllabusDrop } from "@/components/uni/SyllabusDrop";
import { nowHM, todayISO } from "@/lib/dates";
import { upcomingDeadlines } from "@/lib/selectors";
import { rankDeadlines } from "@/lib/uni";

export default function UniPage() {
  const { tasks, courses, assignment_meta, loading } = useData();
  const cal = useCalendar();
  if (loading) return <Loading />;

  const deadlines = upcomingDeadlines(tasks, todayISO(), 200, cal.events, nowHM());
  const ranked = rankDeadlines(deadlines, courses, assignment_meta);
  // Nombres de cursos tal como Canvas los pone en el calendario (para emparejar syllabus).
  const calendarNames = [...new Set(cal.events.map((e) => e.course).filter((c): c is string => !!c))].sort();

  return (
    <>
      <PageTitle
        title="Universidad"
        sub={`Fall 2026 · ${courses.length} ${courses.length === 1 ? "curso" : "cursos"} · ${ranked.length} ${ranked.length === 1 ? "entrega próxima" : "entregas próximas"}${cal.available ? " en 3 semanas" : ""}`}
      />
      <Columns
        mainBasis={600}
        main={
          <>
            <SyllabusDrop calendarNames={calendarNames} />
            {cal.error && <div className="empty">{cal.error}</div>}
            <PriorityCard items={ranked} loading={cal.loading} />
          </>
        }
        side={
          <>
            <StudyPlanCard items={ranked} />
            <CoursesCard calendarNames={calendarNames} />
            <AreaTasksCard area="uni" title="Mis tareas de la uni" compact />
          </>
        }
      />
    </>
  );
}

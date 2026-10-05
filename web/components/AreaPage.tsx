"use client";

import { AreaTasksCard, Columns, GoalsCard, Loading, PageTitle, RemindersCard } from "./Cards";
import { useData } from "./DataProvider";
import type { Area } from "@/lib/types";

export function AreaPage({ area, title, sub }: { area: Area; title: string; sub: string }) {
  const { loading } = useData();
  if (loading) return <Loading />;
  return (
    <>
      <PageTitle title={title} sub={sub} />
      <Columns
        main={<AreaTasksCard area={area} />}
        side={
          <>
            <GoalsCard area={area} kicker="Objetivos" />
            <RemindersCard area={area} />
          </>
        }
      />
    </>
  );
}

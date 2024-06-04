import FormulaEditor from "@/components/FormulaEditor";
import "prosemirror-view/style/prosemirror.css";
import {AGGREGATION, DIMENSIONS, METRICS, OPERATOR} from "@/shared/constants";
import React, {useEffect, useState} from "react";

export default function Home()
{
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return <div>Loading...</div>;

  return (
    <FormulaEditor
      metrics={METRICS}
      dimensions={DIMENSIONS}
      aggregation={AGGREGATION}
      operator={OPERATOR}
    />
  );
}

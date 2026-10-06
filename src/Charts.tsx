import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  money,
  monthLabel,
} from "./engine";


type PersonalPoint = {
  name: string;
  balance: number;
};


type ProjectionPoint = {
  date: string;
  current: number;
  wealth: number;
  wealthNet: number;
  travel: number;
};


type PiePoint = {
  name: string;
  value: number;
};


type AnalysisCategory = {
  id: string;
  name: string;
};


type AnalysisPoint =
  Record<
    string,
    string | number
  >;


type Props =
  | {
      kind: "personal";
      data: PersonalPoint[];
    }
  | {
      kind: "projection";
      data: ProjectionPoint[];
    }
  | {
      kind: "pie";
      data: PiePoint[];
      palette: string[];
    }
  | {
      kind: "analysis";
      data: AnalysisPoint[];
      cats: AnalysisCategory[];
      analysisCats:
        | string[]
        | null;
      palette: string[];
    };


export default function Charts(
  props: Props,
) {

  if (
    props.kind ===
    "personal"
  ) {

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={props.data}
        >
          <CartesianGrid
            vertical={false}
          />

          <XAxis
            dataKey="name"
            tick={{
              fontSize: 11,
            }}
          />

          <YAxis
            tickFormatter={(v) =>
              Math.round(
                Number(v) / 100,
              ) + " €"
            }
            width={70}
          />

          <Tooltip
            formatter={(v) =>
              money(Number(v))
            }
          />

          <Line
            type="monotone"
            dataKey="balance"
            name="Solde projeté"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );

  }


  if (
    props.kind ===
    "projection"
  ) {

    const data =
      props.data.map(
        (p) => ({
          ...p,

          patrimoineTotal:
            p.current +
            p.wealth,

          patrimoineNet:
            p.current +
            p.wealthNet,
        }),
      );

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={data}
          margin={{
            left: 0,
            right: 12,
            top: 20,
            bottom: 10,
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#e9edf2"
          />

          <XAxis
            dataKey="date"
            tickFormatter={(d) =>
              String(d).slice(
                0,
                4,
              )
            }
            tick={{
              fontSize: 12,
            }}
          />

          <YAxis
            tickFormatter={(n) =>
              (
                Number(n) /
                100000
              ).toFixed(0) +
              " k€"
            }
            width={60}
            tick={{
              fontSize: 12,
            }}
          />

          <Tooltip
            formatter={(v) => {

              const value =
                Number(v);

              if (
                window.matchMedia(
                  "(max-width: 560px)",
                ).matches
              ) {

                return (
                  new Intl.NumberFormat(
                    "fr-FR",
                    {
                      maximumFractionDigits: 0,
                    },
                  ).format(
                    value /
                      100000,
                  ) + " k€"
                );

              }

              return money(
                value,
              );

            }}
            labelFormatter={(d) =>
              monthLabel(
                String(d),
              )
            }
          />

          <Legend />

          <Line
            name="Patrimoine total"
            dataKey="patrimoineTotal"
            stroke="var(--chart)"
            strokeWidth={3}
            dot={false}
          />

          <Line
            name="Patrimoine après fiscalité"
            dataKey="patrimoineNet"
            stroke="#8d98a8"
            strokeWidth={2}
            strokeDasharray="7 6"
            dot={false}
          />

          <Line
            name="Voyages"
            dataKey="travel"
            stroke="#76aa9e"
            strokeWidth={3}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>
    );

  }


  if (
    props.kind ===
    "pie"
  ) {

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <PieChart>
          <Pie
            data={props.data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={3}
          >
            {props.data.map(
              (_, i) => (
                <Cell
                  key={i}
                  fill={
                    props.palette[
                      i %
                        props.palette
                          .length
                    ]
                  }
                />
              ),
            )}
          </Pie>

          <Tooltip
            formatter={(v) =>
              money(Number(v))
            }
          />
        </PieChart>
      </ResponsiveContainer>
    );

  }


  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
    >
      <LineChart
        data={props.data}
        margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="#e9edf2"
        />

        <XAxis
          dataKey="name"
          tickFormatter={(value) => new Date(String(value) + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
          minTickGap={28}
          interval="preserveStartEnd"
          tick={{
            fontSize: 11,
          }}
        />

        <YAxis
          tickFormatter={(v) =>
            Math.round(
              Number(v) /
                100,
            ) + " €"
          }
          width={65}
          tick={{
            fontSize: 12,
          }}
        />

        <Tooltip
          isAnimationActive={false}
          position={{ x: 54, y: 0 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const entries = payload.filter(p => Number(p.value) > 0).sort((a,b) => Number(b.value) - Number(a.value));
            return <div className="spending-analysis-tooltip"><strong>{monthLabel(String(label))}</strong>{entries.length ? entries.slice(0,3).map(entry => <div key={String(entry.dataKey)}><span><i style={{background: entry.color}}/>{String(entry.name)}</span><b>{money(Number(entry.value))}</b></div>) : <p>Aucune dépense</p>}{entries.length > 3 && <div><span>{entries.length - 3} autres catégories</span><b>{money(entries.slice(3).reduce((sum,p) => sum + Number(p.value),0))}</b></div>}</div>;
          }}
        />

        {props.cats
          .filter(
            (c) =>
              props.analysisCats ===
                null ||
              props.analysisCats.includes(
                c.id,
              ),
          )
          .map((c) => (

            <Line
              key={c.id}
              name={c.name}
              dataKey={c.id}
              stroke={
                props.palette[
                  props.cats.findIndex(
                    (x) =>
                      x.id ===
                      c.id,
                  ) %
                    props.palette
                      .length
                ]
              }
              type="linear"
              strokeWidth={2.5}
              dot={props.data.length <= 12 ? { r: 2 } : false}
              activeDot={{ r: 4 }}
              isAnimationActive={props.data.length <= 24}
            />

          ))}

      </LineChart>
    </ResponsiveContainer>
  );

}

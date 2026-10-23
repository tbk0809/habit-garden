import type { DashboardDTO } from "../../shared/domain/dashboard.ts";
import styles from "./garden.module.css";

type Plant = DashboardDTO["plants"][number];
type OwnedPlant = Extract<Plant, { unlocked: true }>;

const stageNames: Record<OwnedPlant["stage"], string> = {
  sprout: "Sprout",
  seedling: "Seedling",
  growing: "Growing",
  mature: "Mature",
};

function Leaves({ y, size = 1 }: { y: number; size?: number }) {
  return (
    <g transform={`translate(120 ${y}) scale(${size})`}>
      <path
        className={styles.leaf}
        d="M0 0C-20 2-33-10-34-24C-15-26-2-16 0 0Z"
      />
      <path
        className={styles.lightLeaf}
        d="M0 0C20 2 33-10 34-24C15-26 2-16 0 0Z"
      />
    </g>
  );
}

function CloverHead({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      {[0, 120, 240].map((angle) => (
        <path
          key={angle}
          transform={`rotate(${angle})`}
          className={styles.cloverLeaf}
          d="M0 0C-4-5-19-12-17-23C-15-32-5-32 0-24C5-32 15-32 17-23C19-12 4-5 0 0Z"
        />
      ))}
      <circle r="3" className={styles.stemFill} />
    </g>
  );
}

function Flower({
  kind,
  stageIndex,
}: Pick<OwnedPlant, "stageIndex"> & { kind: "daisy" | "sunflower" }) {
  const top = [143, 116, 86, 69][stageIndex];
  const sunflower = kind === "sunflower";

  return (
    <>
      <path className={styles.stem} d={`M120 179Q115 150 120 ${top}`} />
      <Leaves
        y={164}
        size={stageIndex === 0 ? 0.52 : sunflower ? 0.95 : 0.73}
      />
      {stageIndex > 0 && <Leaves y={137} size={sunflower ? 0.73 : 0.55} />}
      {stageIndex === 2 && (
        <g transform={`translate(120 ${top})`}>
          <path
            className={styles.leaf}
            d="M0 8C-24-7-16-28 0-22C16-28 24-7 0 8Z"
          />
          <path
            className={sunflower ? styles.goldBud : styles.daisyBud}
            d="M0 5C-11-5-10-20 0-25C10-20 11-5 0 5Z"
          />
        </g>
      )}
      {stageIndex === 3 && (
        <g transform={`translate(120 ${top})`}>
          {Array.from({ length: sunflower ? 12 : 10 }, (_, index) => (
            <ellipse
              key={index}
              className={sunflower ? styles.sunflowerPetal : styles.daisyPetal}
              cx="0"
              cy={sunflower ? -24 : -20}
              rx={sunflower ? 8 : 6}
              ry={sunflower ? 17 : 15}
              transform={`rotate(${index * (sunflower ? 30 : 36)})`}
            />
          ))}
          <circle
            r={sunflower ? 18 : 11}
            className={sunflower ? styles.sunflowerCenter : styles.daisyCenter}
          />
          {sunflower && (
            <g className={styles.seedDots}>
              <circle cx="-6" cy="-5" r="2" />
              <circle cx="6" cy="-5" r="2" />
              <circle cy="5" r="2" />
            </g>
          )}
        </g>
      )}
    </>
  );
}

function Clover({ stageIndex }: Pick<OwnedPlant, "stageIndex">) {
  if (stageIndex === 0) {
    return (
      <>
        <path className={styles.stem} d="M120 179Q118 163 120 148" />
        <Leaves y={151} size={0.55} />
      </>
    );
  }

  return (
    <>
      <path className={styles.stem} d="M120 179Q112 144 120 113" />
      <CloverHead x={120} y={113} size={stageIndex === 1 ? 0.65 : 0.83} />
      {stageIndex > 1 && (
        <>
          <path className={styles.stem} d="M120 179Q95 163 83 142" />
          <CloverHead x={83} y={142} size={0.64} />
        </>
      )}
      {stageIndex === 3 && (
        <>
          <path className={styles.stem} d="M120 179Q144 153 158 128" />
          <CloverHead x={158} y={128} size={0.8} />
          <path className={styles.stem} d="M119 179Q130 168 140 162" />
          <CloverHead x={140} y={162} size={0.48} />
        </>
      )}
    </>
  );
}

function Cherry({ stageIndex }: Pick<OwnedPlant, "stageIndex">) {
  if (stageIndex < 2) {
    return (
      <>
        <path
          className={styles.stem}
          d={`M120 179Q116 153 120 ${stageIndex === 0 ? 145 : 116}`}
        />
        <Leaves
          y={stageIndex === 0 ? 148 : 123}
          size={stageIndex === 0 ? 0.5 : 0.72}
        />
        {stageIndex === 1 && <Leaves y={157} size={0.55} />}
      </>
    );
  }

  return (
    <>
      <path
        className={styles.trunk}
        d="M120 180L120 85M120 131L88 103M120 118L151 90M120 104L105 78"
      />
      <g className={styles.treeCrown}>
        <ellipse cx="89" cy="94" rx="27" ry="24" />
        <ellipse cx="120" cy="75" rx="30" ry="29" />
        <ellipse cx="150" cy="88" rx="29" ry="26" />
        <ellipse cx="121" cy="101" rx="32" ry="25" />
        {stageIndex === 3 && (
          <>
            <ellipse cx="72" cy="111" rx="23" ry="21" />
            <ellipse cx="166" cy="107" rx="24" ry="23" />
            <ellipse cx="117" cy="48" rx="25" ry="22" />
          </>
        )}
      </g>
      <path
        className={styles.treeHighlight}
        d="M79 85Q88 73 100 77M112 54Q122 49 132 56M145 79Q157 78 164 88"
      />
      {stageIndex === 3 && (
        <>
          <path
            className={styles.cherryStem}
            d="M87 105L92 91L99 108M137 82L143 68L151 86M146 122L153 107L160 124"
          />
          <g className={styles.cherryFruit}>
            <circle cx="86" cy="108" r="6" />
            <circle cx="100" cy="111" r="6" />
            <circle cx="136" cy="85" r="6" />
            <circle cx="152" cy="89" r="6" />
            <circle cx="145" cy="125" r="6" />
            <circle cx="161" cy="127" r="6" />
          </g>
        </>
      )}
    </>
  );
}

function PlantIllustration({ plant }: { plant: Plant }) {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 240 208"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.backdrop} cx="120" cy="105" r="86" />
      <ellipse className={styles.soil} cx="120" cy="182" rx="75" ry="10" />
      <path
        className={styles.soilLine}
        d="M65 182H82M159 183H174M105 188H129"
      />
      {plant.unlocked ? (
        <>
          {plant.plantId === "clover" && (
            <Clover stageIndex={plant.stageIndex} />
          )}
          {(plant.plantId === "daisy" || plant.plantId === "sunflower") && (
            <Flower kind={plant.plantId} stageIndex={plant.stageIndex} />
          )}
          {plant.plantId === "cherry" && (
            <Cherry stageIndex={plant.stageIndex} />
          )}
        </>
      ) : (
        <g className={styles.lockDrawing}>
          <path d="M107 105V95A13 13 0 0 1 133 95V105" />
          <rect x="98" y="105" width="44" height="35" rx="8" />
          <circle cx="120" cy="120" r="3" />
          <path d="M120 123V128M93 163H147" />
        </g>
      )}
    </svg>
  );
}

export function Garden({
  plants,
  lifetimeCompletionCount,
}: Pick<DashboardDTO, "plants" | "lifetimeCompletionCount">) {
  return (
    <section className={styles.garden} aria-label="Your garden">
      <div className={styles.header}>
        <div>
          <h2>Your garden</h2>
          <p>Each daily completion helps your garden grow.</p>
        </div>
        <p className={styles.total}>
          <strong>{lifetimeCompletionCount}</strong>{" "}
          <span>
            lifetime{" "}
            {lifetimeCompletionCount === 1 ? "completion" : "completions"}
          </span>
        </p>
      </div>
      <ol className={styles.slots}>
        {plants.map((plant) => (
          <li
            key={plant.plantId}
            className={styles.slot}
            data-slot-index={plant.slotIndex}
          >
            <figure>
              <PlantIllustration plant={plant} />
              <figcaption className={styles.caption}>
                <h3>{plant.name}</h3>
                {plant.unlocked ? (
                  <>
                    <p className={styles.stage}>{stageNames[plant.stage]}</p>
                    <p className={styles.detail}>
                      {plant.growthPoints} growth{" "}
                      {plant.growthPoints === 1 ? "point" : "points"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={styles.locked}>Locked</p>
                    <p className={styles.detail}>
                      Unlocks at {plant.unlockAt} lifetime completions
                    </p>
                  </>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { useId, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const USAGE_SOURCES = [
  { key: 'app', label: 'App', color: '#3de8a0' },
  { key: 'base', label: 'Base', color: '#ff9f40' },
  { key: 'ssw', label: 'SSW', color: '#6b7280' },
];

const OCCURRENCE_NOTE = 'Ocorrências consideradas: 01, 03, 10, 11, 13, 38 e 60.';

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function getUsageTotals(appUsage) {
  return appUsage.reduce((totals, row) => ({
    app: totals.app + (Number(row.app) || 0),
    base: totals.base + (Number(row.base) || 0),
    ssw: totals.ssw + (Number(row.ssw) || 0),
  }), { app: 0, base: 0, ssw: 0 });
}

function UsageTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div style={styles.tooltip}>
      <div style={{ ...styles.tooltipLabel, color: item.color }}>{item.label}</div>
      <div style={styles.tooltipValue}>{formatCount(item.value)} registros</div>
      <div style={styles.tooltipPercent}>{formatPercent(item.percent)}</div>
    </div>
  );
}

export function UsageLegendRow({ label, value, percent, color, active, onEnter, onLeave }) {
  return (
    <div
      className="legend-row"
      role="listitem"
      tabIndex={0}
      aria-label={`${label}: ${formatCount(value)} registros, ${formatPercent(percent)}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      style={{ ...styles.legendRow, ...(active ? styles.legendRowActive : {}) }}
    >
      <span aria-hidden="true" style={{ ...styles.legendSwatch, background: color }} />
      <span style={styles.legendLabel}>{label}</span>
      <span style={{ ...styles.legendValue, color }}>{formatCount(value)}</span>
      <span style={styles.legendPercent}>{formatPercent(percent)}</span>
    </div>
  );
}

export function UsagePieSummary({ appUsage = [], loading = false, title = 'Distribuição do uso', showNote = true }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const instanceId = useId().replace(/:/g, '');
  const titleId = `usage-pie-title-${instanceId}`;
  const descriptionId = `usage-pie-description-${instanceId}`;
  const totals = getUsageTotals(appUsage);
  const totalUsage = totals.app + totals.base + totals.ssw;
  const chartData = USAGE_SOURCES.map(source => ({
    ...source,
    value: totals[source.key],
    percent: totalUsage > 0 ? (totals[source.key] / totalUsage) * 100 : 0,
  }));
  const description = chartData
    .map(item => `${item.label}: ${formatCount(item.value)} registros, ${formatPercent(item.percent)}`)
    .join('. ');

  const handleEnter = (index) => setActiveIndex(index);
  const handleLeave = () => setActiveIndex(null);

  return (
    <section
      className="usage-summary-surface"
      style={{ ...styles.surface, opacity: loading ? 0.55 : 1 }}
      aria-labelledby={titleId}
      aria-busy={loading}
    >
      <div style={styles.header}>
        <div style={styles.captionGroup}>
          <div id={titleId} style={styles.caption}>{title}</div>
          {loading && <span aria-live="polite" style={styles.updating}>Atualizando dados…</span>}
        </div>
        <div style={styles.totalDatum}>
          <span style={styles.totalLabel}>TOTAL DE REGISTROS</span>
          <strong style={styles.totalValue}>{formatCount(totalUsage)}</strong>
        </div>
      </div>

      <div className="usage-summary-body" style={styles.body}>
        {totalUsage === 0 ? (
          <div style={styles.zeroState}>
            <div aria-hidden="true" style={styles.zeroCircle} />
            <span>Nenhum registro encontrado para os filtros e ocorrências selecionados.</span>
          </div>
        ) : (
          <div
            className="usage-pie-chart"
            role="img"
            aria-labelledby={`${titleId} ${descriptionId}`}
            style={styles.chart}
          >
            <span id={descriptionId} style={styles.visuallyHidden}>{description}</span>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius="90%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="#161920"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => handleEnter(index)}
                  onMouseLeave={handleLeave}
                >
                  {chartData.map((item, index) => (
                    <Cell
                      key={item.key}
                      fill={item.color}
                      stroke="#161920"
                      strokeWidth={1.5}
                      opacity={activeIndex === null || activeIndex === index ? 0.82 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<UsageTooltip />}
                  isAnimationActive={false}
                  cursor={false}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {totalUsage > 0 && (
          <div role="list" aria-label="Legenda da distribuição do uso" style={styles.legend}>
            {chartData.map((item, index) => (
              <UsageLegendRow
                key={item.key}
                label={item.label}
                value={item.value}
                percent={item.percent}
                color={item.color}
                active={activeIndex === index}
                onEnter={() => handleEnter(index)}
                onLeave={handleLeave}
              />
            ))}
          </div>
        )}
      </div>

      {showNote && <div style={styles.note}>{OCCURRENCE_NOTE}</div>}
    </section>
  );
}

const styles = {
  surface: {
    background: '#161920',
    border: '1px solid #2a2f3e',
    borderRadius: 8,
    padding: '16px 18px',
    marginBottom: 16,
    transition: 'opacity .15s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 38,
  },
  captionGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  caption: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.05rem',
    letterSpacing: '1.5px',
    color: '#f0c040',
  },
  updating: {
    color: '#6b7280',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.62rem',
  },
  totalDatum: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  totalLabel: {
    color: '#6b7280',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '1px',
  },
  totalValue: {
    color: '#e8eaf0',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '1.35rem',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  body: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    minWidth: 0,
    minHeight: 132,
  },
  chart: {
    width: 132,
    height: 132,
    flex: '0 0 132px',
    minWidth: 0,
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  legendRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(78px, 1fr) 56px 46px',
    alignItems: 'center',
    columnGap: 6,
    minHeight: 28,
    padding: '2px 5px',
    borderRadius: 3,
    outline: 'none',
    cursor: 'default',
    transition: 'background .12s ease',
  },
  legendRowActive: {
    background: '#2a2f3e',
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: '50%',
  },
  legendLabel: {
    color: '#e8eaf0',
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
  },
  legendValue: {
    textAlign: 'right',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.78rem',
    fontVariantNumeric: 'tabular-nums',
  },
  legendPercent: {
    color: '#9ca3af',
    textAlign: 'right',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.72rem',
    fontVariantNumeric: 'tabular-nums',
  },
  note: {
    color: '#6b7280',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.68rem',
    lineHeight: 1.4,
    marginTop: 8,
  },
  zeroState: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#6b7280',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.72rem',
    minHeight: 132,
  },
  zeroCircle: {
    width: 20,
    height: 20,
    border: '2px solid #6b7280',
    borderRadius: '50%',
    flexShrink: 0,
  },
  tooltip: {
    background: '#1e2230',
    border: '1px solid #2a2f3e',
    borderRadius: 4,
    padding: '8px 10px',
    boxShadow: '0 6px 16px rgba(0,0,0,.28)',
  },
  tooltipLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  tooltipValue: {
    color: '#e8eaf0',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.7rem',
    marginTop: 3,
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipPercent: {
    color: '#9ca3af',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};

export default UsagePieSummary;

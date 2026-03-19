import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DataGrid,
  Row as DefaultRow,
  SelectColumn,
  type Column,
  type SortColumn,
  type RenderCellProps,
  type RenderEditCellProps,
  type RenderRowProps,
} from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import type { StudentRow, Grade, Status } from '../../types/student';
import { EXERCISE_KEYS, GRADES, STATUSES } from '../../types/student';
import { getStudents, computeAggregates } from '../../data/generateStudents';
import { mockDbSave } from '../../data/mockDb';
import { usePerformanceTracker } from '../../hooks/usePerformanceTracker';
import { PerformancePanel } from '../../components/PerformancePanel';
import './ReactDataGridPage.css';

// ─── Types ──────────────────────────────────────────────────
type RowType = StudentRow & { _type?: 'detail'; _parentId?: number; _expanded?: boolean };

// ─── Grade / Status constants ───────────────────────────────
const GRADE_COLORS: Record<Grade, string> = { A: '#a6e3a1', B: '#89b4fa', C: '#f9e2af', D: '#fab387', F: '#f38ba8' };
const STATUS_CFG: Record<Status, { icon: string; color: string }> = {
  Active: { icon: '\u25CF', color: '#a6e3a1' },
  Inactive: { icon: '\u25CF', color: '#f38ba8' },
  Graduated: { icon: '\u25CF', color: '#89b4fa' },
};

// ─── Single-click & Tab/Enter navigation helpers ─────────────
const EDITABLE_COL_KEYS = ['name', 'email', 'age', 'grade', 'status', 'enrollmentDate', ...EXERCISE_KEYS];
const COL_KEY_TO_IDX: Record<string, number> = {};
EDITABLE_COL_KEYS.forEach((key, i) => { COL_KEY_TO_IDX[key] = i + 2; }); // +2 for SelectColumn & expand

let _gridHandle: { selectCell: (pos: { idx: number; rowIdx: number }, enableEditor?: boolean) => void } | null = null;
let _rowIdToIdx: Map<number, number> = new Map();

function navigateToNextEditableCell(currentColKey: string, rowId: number) {
  const currentPos = EDITABLE_COL_KEYS.indexOf(currentColKey);
  if (currentPos === -1 || currentPos >= EDITABLE_COL_KEYS.length - 1) return;
  const nextColIdx = COL_KEY_TO_IDX[EDITABLE_COL_KEYS[currentPos + 1]];
  const rowIdx = _rowIdToIdx.get(rowId) ?? -1;
  if (rowIdx === -1) return;
  setTimeout(() => _gridHandle?.selectCell({ idx: nextColIdx, rowIdx }, true), 0);
}


// ─── Score bar renderer ─────────────────────────────────────
function ScoreBar({ value }: { value: number }) {
  const v = value ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${Math.min(v, 100)}%`, background: color }} />
      <span className="score-text">{v}</span>
    </div>
  );
}

function PassRateBar({ value }: { value: number }) {
  const v = value ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${v}%`, background: color }} />
      <span className="score-text">{v}%</span>
    </div>
  );
}

// ─── Render cells ───────────────────────────────────────────
function renderGradeCell({ row }: RenderCellProps<RowType>) {
  return <span className="grade-badge" style={{ background: GRADE_COLORS[row.grade] }}>{row.grade}</span>;
}

function renderStatusCell({ row }: RenderCellProps<RowType>) {
  const cfg = STATUS_CFG[row.status];
  return <span className="status-cell"><span style={{ color: cfg.color }}>{cfg.icon}</span> {row.status}</span>;
}

function renderScoreCell(key: string) {
  return function ScoreCell({ row }: RenderCellProps<RowType>) {
    return <ScoreBar value={row[key as keyof StudentRow] as number} />;
  };
}

function renderReadonlyScore({ row, column }: RenderCellProps<RowType>) {
  return <ScoreBar value={row[column.key as keyof StudentRow] as number} />;
}

function renderPassRate({ row }: RenderCellProps<RowType>) {
  return <PassRateBar value={row.passRate} />;
}

// ─── Edit cells ─────────────────────────────────────────────
function TextEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<RowType>) {
  return (
    <input
      className="rdg-cell-input"
      autoFocus
      value={row[column.key as keyof StudentRow] as string}
      onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value })}
      onBlur={() => onClose(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          onClose(true);
          navigateToNextEditableCell(column.key, row.id);
        }
        if (e.key === 'Escape') onClose(false);
      }}
    />
  );
}

function NumberEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<RowType>) {
  return (
    <input
      className="rdg-cell-input"
      type="number"
      autoFocus
      value={row[column.key as keyof StudentRow] as number}
      onChange={(e) => onRowChange({ ...row, [column.key]: Number(e.target.value) })}
      onBlur={() => onClose(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          onClose(true);
          navigateToNextEditableCell(column.key, row.id);
        }
        if (e.key === 'Escape') onClose(false);
      }}
    />
  );
}

function GradeEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<RowType>) {
  return (
    <select
      className="rdg-cell-select"
      autoFocus
      value={row.grade}
      onChange={(e) => {
        onRowChange({ ...row, grade: e.target.value as Grade }, true);
        navigateToNextEditableCell(column.key, row.id);
      }}
      onBlur={() => onRowChange(row, true)}
      onKeyDown={(e) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          onClose(true);
          navigateToNextEditableCell(column.key, row.id);
        }
      }}
    >
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}

function StatusEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<RowType>) {
  return (
    <select
      className="rdg-cell-select"
      autoFocus
      value={row.status}
      onChange={(e) => {
        onRowChange({ ...row, status: e.target.value as Status }, true);
        navigateToNextEditableCell(column.key, row.id);
      }}
      onBlur={() => onRowChange(row, true)}
      onKeyDown={(e) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          onClose(true);
          navigateToNextEditableCell(column.key, row.id);
        }
      }}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// ─── Detail panel ───────────────────────────────────────────
function DetailPanel({ student }: { student: StudentRow }) {
  return (
    <div className="detail-panel">
      <div className="detail-info">
        <h4>{student.name}</h4>
        <p>{student.email} &middot; Age {student.age} &middot; {student.status} &middot; Enrolled {student.enrollmentDate}</p>
      </div>
      <div className="detail-scores">
        <span className="detail-label">Exercise Scores</span>
        <div className="detail-bars">
          {EXERCISE_KEYS.map((key, i) => {
            const v = student[key] as number;
            const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
            return (
              <div key={key} className="detail-bar-item">
                <span className="detail-bar-label">{i + 1}</span>
                <div className="detail-bar-track">
                  <div className="detail-bar-fill" style={{ width: `${v}%`, background: color }} />
                </div>
                <span className="detail-bar-value">{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────
export default function ReactDataGridPage({ rowCount }: { rowCount: number }) {
  const students = useMemo(() => getStudents(rowCount), [rowCount]);
  const [data, setData] = useState<StudentRow[]>(() => [...students]);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<number>>(() => new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [bulkGrade, setBulkGrade] = useState<Grade>('A');

  // Grid ref for programmatic cell selection (Tab/Enter navigation)
  const gridRefCallback = useCallback((handle: { selectCell: (pos: { idx: number; rowIdx: number }, enableEditor?: boolean) => void } | null) => {
    _gridHandle = handle;
  }, []);

  const {
    metrics, startMeasure, endMeasure, endMeasureSync, setMetric,
    flashRef, renderCountElRef, renderTimeElRef,
  } = usePerformanceTracker();

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startMeasure('lastFilter');
        setGlobalFilter(value.toLowerCase());
      }, 150);
    },
    [startMeasure],
  );

  // Initial render timing
  const mountTime = useRef(0);
  const initialMeasured = useRef(false);
  useEffect(() => {
    if (!mountTime.current) mountTime.current = performance.now();
    if (initialMeasured.current) return;
    initialMeasured.current = true;
    const t = mountTime.current;
    setTimeout(() => {
      requestAnimationFrame(() => { setMetric('initialRender', performance.now() - t); });
    }, 0);
  }, [setMetric]);

  // Filter end measurement
  const filterRef = useRef(globalFilter);
  useEffect(() => {
    if (filterRef.current !== globalFilter) { filterRef.current = globalFilter; endMeasure('lastFilter'); }
  }, [globalFilter, endMeasure]);

  // Sort end measurement
  const sortRef = useRef(sortColumns);
  useEffect(() => {
    if (sortRef.current !== sortColumns) { sortRef.current = sortColumns; endMeasure('lastSort'); }
  }, [sortColumns, endMeasure]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ─── Columns (stable — expand state is read from row._expanded) ─────────
  const columns: Column<RowType>[] = useMemo(() => [
    SelectColumn as Column<RowType>,
    {
      key: 'expand',
      name: '',
      width: 36,
      minWidth: 36,
      maxWidth: 36,
      frozen: true,
      resizable: false,
      sortable: false,
      renderCell({ row }: RenderCellProps<RowType>) {
        if (row._type === 'detail') return null;
        return (
          <button className="expand-btn" onClick={() => toggleExpanded(row.id)}>
            {row._expanded ? '\u25BC' : '\u25B6'}
          </button>
        );
      },
    },
    { key: 'name', name: 'Name', width: 180, frozen: true, resizable: true, sortable: true, renderEditCell: TextEditor },
    { key: 'email', name: 'Email', width: 260, resizable: true, sortable: true, renderEditCell: TextEditor },
    { key: 'age', name: 'Age', width: 70, resizable: true, sortable: true, renderEditCell: NumberEditor },
    { key: 'grade', name: 'Grade', width: 80, resizable: true, sortable: true, renderCell: renderGradeCell, renderEditCell: GradeEditor },
    { key: 'status', name: 'Status', width: 120, resizable: true, sortable: true, renderCell: renderStatusCell, renderEditCell: StatusEditor },
    { key: 'enrollmentDate', name: 'Enrolled', width: 120, resizable: true, sortable: true, renderEditCell: TextEditor },
    ...EXERCISE_KEYS.map((key, i): Column<RowType> => ({
      key, name: `Ex ${i + 1}`, width: 90, resizable: true, sortable: true,
      renderCell: renderScoreCell(key), renderEditCell: NumberEditor,
    })),
    { key: 'avgScore', name: 'Avg', width: 80, resizable: true, sortable: true, renderCell: renderReadonlyScore },
    { key: 'minScore', name: 'Min', width: 70, resizable: true, sortable: true, renderCell: renderReadonlyScore },
    { key: 'maxScore', name: 'Max', width: 70, resizable: true, sortable: true, renderCell: renderReadonlyScore },
    { key: 'totalPoints', name: 'Total', width: 80, resizable: true, sortable: true },
    { key: 'passRate', name: 'Pass %', width: 90, resizable: true, sortable: true, renderCell: renderPassRate },
  ], [toggleExpanded]);

  // ─── Sorted + filtered rows ────────────────────────────
  const sortedFilteredRows = useMemo(() => {
    let rows = data;
    // Filter
    if (globalFilter) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(globalFilter));
    }
    // Sort
    if (sortColumns.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const { columnKey, direction } of sortColumns) {
          const aVal = a[columnKey as keyof StudentRow];
          const bVal = b[columnKey as keyof StudentRow];
          if (aVal === bVal) continue;
          const cmp = typeof aVal === 'number' && typeof bVal === 'number'
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal));
          return direction === 'ASC' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return rows;
  }, [data, globalFilter, sortColumns]);

  // ─── Rows with detail panels interleaved ───────────────
  const displayRows = useMemo<RowType[]>(() => {
    const result: RowType[] = [];
    for (const row of sortedFilteredRows) {
      const isExpanded = expandedRows.has(row.id);
      result.push(isExpanded ? { ...row, _expanded: true } : row);
      if (isExpanded) {
        result.push({ ...row, _type: 'detail', _parentId: row.id, id: -(row.id + 1) });
      }
    }
    return result;
  }, [sortedFilteredRows, expandedRows]);

  // ─── Keep row-id-to-index map in sync for Tab/Enter navigation ──
  useEffect(() => {
    const map = new Map<number, number>();
    displayRows.forEach((r, i) => { if (r._type !== 'detail') map.set(r.id, i); });
    _rowIdToIdx = map;
  }, [displayRows]);

  // ─── Single-click to enter edit mode ───────────────────
  const handleCellClick = useCallback((args: { row: RowType; column: { key: string } }) => {
    if (args.row._type === 'detail') return;
    const colIdx = COL_KEY_TO_IDX[args.column.key];
    if (colIdx === undefined) return;
    const rowIdx = _rowIdToIdx.get(args.row.id);
    if (rowIdx === undefined) return;
    _gridHandle?.selectCell({ idx: colIdx, rowIdx }, true);
  }, []);

  // ─── Row key getter ────────────────────────────────────
  const rowKeyGetter = useCallback((row: RowType) => row._type === 'detail' ? `detail-${row._parentId}` : row.id, []);

  // ─── Handle row changes (editing) ─────────────────────
  const handleRowsChange = useCallback(
    (newRows: RowType[], { indexes, column }: { indexes: number[]; column: Column<RowType> }) => {
      startMeasure('lastEdit');
      const idx = indexes[0];
      const newRow = newRows[idx];
      if (newRow._type === 'detail') return;

      // Compute aggregates if an exercise score changed
      const updatedRow = newRow as unknown as StudentRow;
      if (column.key.startsWith('ex')) computeAggregates(updatedRow);

      setData((prev) => {
        const oldRow = prev.find((r) => r.id === updatedRow.id);
        const next = prev.map((r) => (r.id === updatedRow.id ? updatedRow : r));
        // Fire async save without blocking state update
        if (oldRow) {
          mockDbSave(oldRow.id, column.key, updatedRow[column.key as keyof StudentRow]).then(
            () => endMeasureSync('lastEdit'),
            (err) => {
              console.error('[ReactDataGrid] Save failed, reverting:', err);
              setData((p) => p.map((r) => (r.id === oldRow.id ? oldRow : r)));
              endMeasureSync('lastEdit');
            },
          );
        }
        return next;
      });
    },
    [startMeasure, endMeasureSync],
  );

  // ─── Handle sort ──────────────────────────────────────
  const handleSortColumnsChange = useCallback(
    (newSortColumns: SortColumn[]) => {
      startMeasure('lastSort');
      setSortColumns(newSortColumns);
    },
    [startMeasure],
  );

  // ─── Bulk actions ─────────────────────────────────────
  const selectedCount = selectedRows.size;
  const handleBulkGradeChange = useCallback(() => {
    if (selectedCount === 0) return;
    startMeasure('lastEdit');
    setData((prev) =>
      prev.map((r) => {
        if (!selectedRows.has(r.id)) return r;
        return { ...r, grade: bulkGrade };
      }),
    );
    endMeasureSync('lastEdit');
  }, [selectedRows, selectedCount, bulkGrade, startMeasure, endMeasureSync]);

  // ─── Custom row renderer for detail rows ──────────────
  const renderRow = useCallback((key: React.Key, props: RenderRowProps<RowType>) => {
    const row = props.row;
    if (row._type === 'detail') {
      return (
        <div key={key} className="rdg-detail-row" style={{ gridRowStart: props.gridRowStart, gridColumnStart: 1, gridColumnEnd: -1 }}>
          <DetailPanel student={row as StudentRow} />
        </div>
      );
    }
    return <DefaultRow key={key} {...props} />;
  }, []);

  // ─── Row height ───────────────────────────────────────
  const rowHeight = useCallback((row: RowType) => {
    return row._type === 'detail' ? 120 : 35;
  }, []);

  const renderers = useMemo(() => ({ renderRow }), [renderRow]);

  return (
    <div className="rdg-page">
      <PerformancePanel
        metrics={metrics} gridName="React Data Grid"
        flashRef={flashRef} renderCountElRef={renderCountElRef} renderTimeElRef={renderTimeElRef}
      />
      <div className="filter-bar">
        <input
          type="text" className="search-input" placeholder="Search student names..."
          value={searchInput} onChange={(e) => handleSearchChange(e.target.value)}
        />
        <span className="row-count">{sortedFilteredRows.length.toLocaleString()} rows</span>
        {selectedCount > 0 && (
          <div className="bulk-actions">
            <span className="bulk-count">{selectedCount} selected</span>
            <select className="bulk-select" value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value as Grade)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <button className="bulk-btn" onClick={handleBulkGradeChange}>Set Grade</button>
          </div>
        )}
        <span className="sort-hint">Ctrl+Click for multi-sort</span>
      </div>
      <div className="rdg-container">
        <DataGrid
          ref={gridRefCallback as any}
          columns={columns}
          rows={displayRows}
          rowKeyGetter={rowKeyGetter}
          rowHeight={rowHeight}
          headerRowHeight={40}
          sortColumns={sortColumns}
          onSortColumnsChange={handleSortColumnsChange}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows as (rows: Set<string | number>) => void}
          onRowsChange={handleRowsChange}
          onCellClick={handleCellClick as any}
          renderers={renderers}
          defaultColumnOptions={{ resizable: true, sortable: true }}
          className="rdg-dark rdg-custom"
        />
      </div>
    </div>
  );
}

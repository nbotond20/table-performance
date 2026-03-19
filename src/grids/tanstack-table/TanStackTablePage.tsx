import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type ColumnPinningState,
  type CellContext,
  type Row,
  type Header,
  type Column,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { StudentRow, Grade, Status } from '../../types/student';
import { EXERCISE_KEYS, GRADES, STATUSES } from '../../types/student';
import { getStudents, computeAggregates } from '../../data/generateStudents';
import { mockDbSave } from '../../data/mockDb';
import { usePerformanceTracker } from '../../hooks/usePerformanceTracker';
import { PerformancePanel } from '../../components/PerformancePanel';
import './TanStackTablePage.css';

const columnHelper = createColumnHelper<StudentRow>();

type TableMeta = {
  updateData: (rowIndex: number, columnId: string, value: unknown) => Promise<void>;
  expandedRows: Set<string>;
  toggleExpanded: (rowId: string) => void;
};

// ─── Editable text cell ─────────────────────────────────────
function EditableTextCell({ getValue, row, column, table }: CellContext<StudentRow, string>) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setValue(initialValue); }, [initialValue]);
  const onSave = async () => {
    setEditing(false);
    if (value === initialValue) return;
    await (table.options.meta as TableMeta).updateData(row.index, column.id, value);
  };
  if (!editing) return <div className="cell-value" onDoubleClick={() => setEditing(true)}>{initialValue}</div>;
  return (
    <input className="cell-input" type="text" value={value} autoFocus
      onChange={(e) => setValue(e.target.value)} onBlur={onSave}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }} />
  );
}

// ─── Editable score cell with progress bar ──────────────────
function EditableScoreCell({ getValue, row, column, table }: CellContext<StudentRow, number>) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setValue(initialValue); }, [initialValue]);
  const onSave = async () => {
    setEditing(false);
    const numVal = Number(value);
    if (numVal === initialValue) return;
    await (table.options.meta as TableMeta).updateData(row.index, column.id, numVal);
  };
  if (!editing) {
    const v = initialValue ?? 0;
    const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
    return (
      <div className="score-cell" onDoubleClick={() => setEditing(true)}>
        <div className="score-bar" style={{ width: `${v}%`, background: color }} />
        <span className="score-text">{v}</span>
      </div>
    );
  }
  return (
    <input className="cell-input" type="number" value={value} autoFocus
      onChange={(e) => setValue(Number(e.target.value))} onBlur={onSave}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }} />
  );
}

// ─── Editable number cell (plain) ───────────────────────────
function EditableNumberCell({ getValue, row, column, table }: CellContext<StudentRow, number>) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setValue(initialValue); }, [initialValue]);
  const onSave = async () => {
    setEditing(false);
    const numVal = Number(value);
    if (numVal === initialValue) return;
    await (table.options.meta as TableMeta).updateData(row.index, column.id, numVal);
  };
  if (!editing) return <div className="cell-value" onDoubleClick={() => setEditing(true)}>{initialValue}</div>;
  return (
    <input className="cell-input" type="number" value={value} autoFocus
      onChange={(e) => setValue(Number(e.target.value))} onBlur={onSave}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }} />
  );
}

// ─── Grade select cell ──────────────────────────────────────
const GRADE_COLORS: Record<Grade, string> = { A: '#a6e3a1', B: '#89b4fa', C: '#f9e2af', D: '#fab387', F: '#f38ba8' };

function GradeSelectCell({ getValue, row, column, table }: CellContext<StudentRow, Grade>) {
  const initialValue = getValue();
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="cell-value" onDoubleClick={() => setEditing(true)}>
        <span className="grade-badge" style={{ background: GRADE_COLORS[initialValue] }}>{initialValue}</span>
      </div>
    );
  }
  return (
    <select className="cell-select" value={initialValue} autoFocus
      onChange={async (e) => { setEditing(false); await (table.options.meta as TableMeta).updateData(row.index, column.id, e.target.value); }}
      onBlur={() => setEditing(false)}>
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}

// ─── Status select cell ─────────────────────────────────────
const STATUS_CFG: Record<Status, { icon: string; color: string }> = {
  Active: { icon: '\u25CF', color: '#a6e3a1' },
  Inactive: { icon: '\u25CF', color: '#f38ba8' },
  Graduated: { icon: '\u25CF', color: '#89b4fa' },
};

function StatusSelectCell({ getValue, row, column, table }: CellContext<StudentRow, Status>) {
  const initialValue = getValue();
  const [editing, setEditing] = useState(false);
  if (!editing) {
    const cfg = STATUS_CFG[initialValue];
    return (
      <div className="cell-value status-cell" onDoubleClick={() => setEditing(true)}>
        <span style={{ color: cfg.color }}>{cfg.icon}</span> {initialValue}
      </div>
    );
  }
  return (
    <select className="cell-select" value={initialValue} autoFocus
      onChange={async (e) => { setEditing(false); await (table.options.meta as TableMeta).updateData(row.index, column.id, e.target.value); }}
      onBlur={() => setEditing(false)}>
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// ─── Readonly cells ─────────────────────────────────────────
function ReadonlyScoreCell({ getValue }: CellContext<StudentRow, number>) {
  const v = getValue() ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${Math.min(v, 100)}%`, background: color }} />
      <span className="score-text">{v}</span>
    </div>
  );
}

function ReadonlyPassRateCell({ getValue }: CellContext<StudentRow, number>) {
  const v = getValue() ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${v}%`, background: color }} />
      <span className="score-text">{v}%</span>
    </div>
  );
}

// ─── Expand cell (reads from meta, not column closure) ──────
function ExpandCell({ row, table }: CellContext<StudentRow, unknown>) {
  const meta = table.options.meta as TableMeta;
  const isExpanded = meta.expandedRows.has(row.id);
  return (
    <button className="expand-btn" onClick={() => meta.toggleExpanded(row.id)}>
      {isExpanded ? '\u25BC' : '\u25B6'}
    </button>
  );
}

// ─── Expansion detail panel ─────────────────────────────────
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

// ─── Column resize handle ───────────────────────────────────
function ResizeHandle({ header }: { header: Header<StudentRow, unknown> }) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={`resize-handle ${header.column.getIsResizing() ? 'resizing' : ''}`}
    />
  );
}

// ─── Pinning offset helpers ─────────────────────────────────
function getColumnPinOffset(column: Column<StudentRow, unknown>, table: ReturnType<typeof useReactTable<StudentRow>>) {
  const pinned = column.getIsPinned();
  if (!pinned) return undefined;
  const allCols = table.getVisibleFlatColumns();
  if (pinned === 'left') {
    let offset = 0;
    for (const col of allCols) {
      if (col.id === column.id) break;
      if (col.getIsPinned() === 'left') offset += col.getSize();
    }
    return { position: 'sticky' as const, left: offset, zIndex: 2, background: '#1e1e2e' };
  }
  // right
  let offset = 0;
  for (let i = allCols.length - 1; i >= 0; i--) {
    if (allCols[i].id === column.id) break;
    if (allCols[i].getIsPinned() === 'right') offset += allCols[i].getSize();
  }
  return { position: 'sticky' as const, right: offset, zIndex: 2, background: '#1e1e2e' };
}

function cellAs<T>(fn: (ctx: CellContext<StudentRow, T>) => React.ReactNode) {
  return fn as unknown as (ctx: CellContext<StudentRow, T>) => React.ReactNode;
}

// ─── Flat item type for virtualization with expansion ───────
type FlatItem =
  | { type: 'row'; row: Row<StudentRow> }
  | { type: 'detail'; row: Row<StudentRow> };

export default function TanStackTablePage({ rowCount }: { rowCount: number }) {
  const students = useMemo(() => getStudents(rowCount), [rowCount]);
  const [data, setData] = useState<StudentRow[]>(() => [...students]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // Manual expansion tracking — avoids getExpandedRowModel processing all rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnPinning] = useState<ColumnPinningState>({
    left: ['select', 'expand', 'name'],
    right: ['avgScore', 'passRate'],
  });
  const [bulkGrade, setBulkGrade] = useState<Grade>('A');

  // Reset data when rowCount changes
  useEffect(() => {
    setData([...students]);
    setExpandedRows(new Set());
    setRowSelection({});
    setSorting([]);
    setGlobalFilter('');
    setSearchInput('');
  }, [students]);

  const {
    metrics, startMeasure, endMeasure, endMeasureSync, setMetric,
    flashRef, renderCountElRef, renderTimeElRef,
  } = usePerformanceTracker();

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

  const mountTime = useRef(0);
  const initialMeasured = useRef(false);

  const selectedCount = Object.keys(rowSelection).length;
  const handleBulkGradeChange = useCallback(() => {
    if (selectedCount === 0) return;
    startMeasure('lastEdit');
    setData((prev) =>
      prev.map((r) => {
        if (!rowSelection[String(r.id)]) return r;
        return { ...r, grade: bulkGrade };
      }),
    );
    endMeasureSync('lastEdit');
  }, [rowSelection, selectedCount, bulkGrade, startMeasure, endMeasureSync]);

  const toggleExpanded = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select', size: 40, enableResizing: false, enablePinning: true,
        header: ({ table }) => (
          <input type="checkbox" checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()} />
        ),
        cell: ({ row }) => (
          <input type="checkbox" checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()} />
        ),
      }),
      columnHelper.display({
        id: 'expand', size: 36, enableResizing: false, enablePinning: true,
        header: () => null,
        cell: ExpandCell,
      }),
      columnHelper.accessor('name', {
        header: 'Name', size: 180, enableSorting: true, enablePinning: true,
        cell: cellAs(EditableTextCell),
      }),
      columnHelper.accessor('email', {
        header: 'Email', size: 260, enableSorting: true,
        cell: cellAs(EditableTextCell),
      }),
      columnHelper.accessor('age', {
        header: 'Age', size: 70, enableSorting: true,
        cell: cellAs(EditableNumberCell),
      }),
      columnHelper.accessor('grade', {
        header: 'Grade', size: 80, enableSorting: true,
        cell: cellAs(GradeSelectCell),
      }),
      columnHelper.accessor('status', {
        header: 'Status', size: 120, enableSorting: true,
        cell: cellAs(StatusSelectCell),
      }),
      columnHelper.accessor('enrollmentDate', {
        header: 'Enrolled', size: 120, enableSorting: true,
        cell: cellAs(EditableTextCell),
      }),
      ...EXERCISE_KEYS.map((key, i) =>
        columnHelper.accessor(key as 'ex1', {
          id: key, header: `Ex ${i + 1}`, size: 90, enableSorting: true,
          cell: cellAs(EditableScoreCell),
        }),
      ),
      columnHelper.accessor('avgScore', {
        header: 'Avg', size: 80, enableSorting: true, enablePinning: true,
        cell: cellAs(ReadonlyScoreCell),
      }),
      columnHelper.accessor('minScore', { header: 'Min', size: 70, enableSorting: true, cell: cellAs(ReadonlyScoreCell) }),
      columnHelper.accessor('maxScore', { header: 'Max', size: 70, enableSorting: true, cell: cellAs(ReadonlyScoreCell) }),
      columnHelper.accessor('totalPoints', { header: 'Total', size: 80, enableSorting: true, cell: (info) => info.getValue() }),
      columnHelper.accessor('passRate', {
        header: 'Pass %', size: 90, enableSorting: true, enablePinning: true,
        cell: cellAs(ReadonlyPassRateCell),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection, columnPinning },
    onSortingChange: (updater) => { startMeasure('lastSort'); setSorting(updater); },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    enableMultiSort: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enablePinning: true,
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      return row.original.name.toLowerCase().includes(filterValue);
    },
    meta: {
      updateData: async (rowIndex: number, columnId: string, value: unknown) => {
        startMeasure('lastEdit');
        const oldRow = data[rowIndex];
        const oldValue = oldRow[columnId as keyof StudentRow];
        const newRow = { ...oldRow, [columnId]: value };
        if (columnId.startsWith('ex')) computeAggregates(newRow);
        setData((prev) => prev.map((r, i) => (i === rowIndex ? newRow : r)));
        try {
          await mockDbSave(oldRow.id, columnId, value);
          endMeasureSync('lastEdit');
        } catch (err) {
          console.error('[TanStack] Save failed, reverting:', err);
          setData((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [columnId]: oldValue } : r)));
          endMeasureSync('lastEdit');
        }
      },
      expandedRows,
      toggleExpanded,
    } satisfies TableMeta,
  });

  // End sort measure after re-render
  const sortRef = useRef(sorting);
  useEffect(() => {
    if (sortRef.current !== sorting) { sortRef.current = sorting; endMeasure('lastSort'); }
  }, [sorting, endMeasure]);

  const filterRef = useRef(globalFilter);
  useEffect(() => {
    if (filterRef.current !== globalFilter) { filterRef.current = globalFilter; endMeasure('lastFilter'); }
  }, [globalFilter, endMeasure]);

  // Flatten rows + manually tracked expanded detail rows
  const { rows: tableRows } = table.getRowModel();
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const row of tableRows) {
      items.push({ type: 'row', row });
      if (expandedRows.has(row.id)) {
        items.push({ type: 'detail', row });
      }
    }
    return items;
  }, [tableRows, expandedRows]);

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => flatItems[index]?.type === 'detail' ? 120 : 35,
    overscan: 20,
  });

  // Measure initial render
  useEffect(() => {
    if (!mountTime.current) mountTime.current = performance.now();
    if (initialMeasured.current) return;
    initialMeasured.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { setMetric('initialRender', performance.now() - mountTime.current); });
    });
  }, [setMetric]);

  const colCount = table.getVisibleFlatColumns().length;

  return (
    <div className="tanstack-page">
      <PerformancePanel
        metrics={metrics} gridName="TanStack Table"
        flashRef={flashRef} renderCountElRef={renderCountElRef} renderTimeElRef={renderTimeElRef}
      />
      <div className="filter-bar">
        <input type="text" className="search-input" placeholder="Search student names..."
          value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        <span className="row-count">{tableRows.length.toLocaleString()} rows</span>
        {selectedCount > 0 && (
          <div className="bulk-actions">
            <span className="bulk-count">{selectedCount} selected</span>
            <select className="bulk-select" value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value as Grade)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <button className="bulk-btn" onClick={handleBulkGradeChange}>Set Grade</button>
          </div>
        )}
        <span className="sort-hint">Shift+Click for multi-sort</span>
      </div>
      <div ref={parentRef} className="table-scroll-container">
        <table className="ts-table" style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinStyle = getColumnPinOffset(header.column, table);
                  return (
                    <th key={header.id}
                      style={{ width: header.getSize(), ...pinStyle, background: pinStyle ? '#181825' : undefined }}
                      className={`${header.column.getCanSort() ? 'sortable' : ''} ${pinStyle ? 'pinned' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' \u25B2'
                        : header.column.getIsSorted() === 'desc' ? ' \u25BC' : ''}
                      {header.column.getCanResize() && <ResizeHandle header={header} />}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = flatItems[virtualItem.index];
              if (item.type === 'detail') {
                return (
                  <tr key={`detail-${item.row.id}`}
                    data-index={virtualItem.index}
                    ref={(node) => virtualizer.measureElement(node)}
                    className="detail-row"
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}>
                    <td colSpan={colCount}>
                      <DetailPanel student={item.row.original} />
                    </td>
                  </tr>
                );
              }
              const row = item.row;
              return (
                <tr key={row.id}
                  data-index={virtualItem.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  className={row.getIsSelected() ? 'row-selected' : ''}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}>
                  {row.getVisibleCells().map((cell) => {
                    const pinStyle = getColumnPinOffset(cell.column, table);
                    return (
                      <td key={cell.id}
                        style={{ width: cell.column.getSize(), ...pinStyle }}
                        className={pinStyle ? 'pinned' : ''}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  type CellContext,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { StudentRow, Grade, Status } from '../../types/student';
import { EXERCISE_KEYS, GRADES, STATUSES } from '../../types/student';
import { students, computeAggregates } from '../../data/generateStudents';
import { mockDbSave } from '../../data/mockDb';
import { usePerformanceTracker } from '../../hooks/usePerformanceTracker';
import { PerformancePanel } from '../../components/PerformancePanel';
import './TanStackTablePage.css';

const columnHelper = createColumnHelper<StudentRow>();

// --- Shared cell meta type ---
type TableMeta = {
  updateData: (rowIndex: number, columnId: string, value: unknown) => Promise<void>;
};

// --- Editable text cell ---
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
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }}
    />
  );
}

// --- Editable number cell with progress bar ---
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
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }}
    />
  );
}

// --- Editable number cell (plain) ---
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
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }}
    />
  );
}

// --- Select cell for Grade ---
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
      onChange={async (e) => {
        setEditing(false);
        await (table.options.meta as TableMeta).updateData(row.index, column.id, e.target.value);
      }}
      onBlur={() => setEditing(false)}
    >
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}

// --- Select cell for Status ---
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
      onChange={async (e) => {
        setEditing(false);
        await (table.options.meta as TableMeta).updateData(row.index, column.id, e.target.value);
      }}
      onBlur={() => setEditing(false)}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// --- Readonly score display ---
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

// Cast helper to satisfy TanStack's cell type
function cellAs<T>(fn: (ctx: CellContext<StudentRow, T>) => React.ReactNode) {
  return fn as unknown as (ctx: CellContext<StudentRow, T>) => React.ReactNode;
}

export default function TanStackTablePage() {
  const [data, setData] = useState<StudentRow[]>(() => [...students]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    colId: string;
  } | null>(null);

  const {
    metrics, startMeasure, endMeasure, endMeasureSync, setMetric,
    flashRef, renderCountElRef, renderTimeElRef,
  } = usePerformanceTracker();

  // Debounce search input -> globalFilter (150ms)
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

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        size: 40,
        header: ({ table }) => (
          <input type="checkbox" checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()} />
        ),
        cell: ({ row }) => (
          <input type="checkbox" checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()} />
        ),
      }),
      // Metadata
      columnHelper.accessor('name', {
        header: 'Name', size: 180, enableSorting: true,
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
      // Exercise scores
      ...EXERCISE_KEYS.map((key, i) =>
        columnHelper.accessor(key as 'ex1', {
          id: key,
          header: `Ex ${i + 1}`,
          size: 90,
          enableSorting: true,
          cell: cellAs(EditableScoreCell),
        }),
      ),
      // Aggregates (readonly)
      columnHelper.accessor('avgScore', {
        header: 'Avg', size: 80, enableSorting: true,
        cell: cellAs(ReadonlyScoreCell),
      }),
      columnHelper.accessor('minScore', {
        header: 'Min', size: 70, enableSorting: true,
        cell: cellAs(ReadonlyScoreCell),
      }),
      columnHelper.accessor('maxScore', {
        header: 'Max', size: 70, enableSorting: true,
        cell: cellAs(ReadonlyScoreCell),
      }),
      columnHelper.accessor('totalPoints', {
        header: 'Total', size: 80, enableSorting: true,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('passRate', {
        header: 'Pass %', size: 90, enableSorting: true,
        cell: cellAs(ReadonlyPassRateCell),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: (updater) => {
      startMeasure('lastSort');
      setSorting(updater);
    },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      return row.original.name.toLowerCase().includes(filterValue);
    },
    meta: {
      updateData: async (rowIndex: number, columnId: string, value: unknown) => {
        startMeasure('lastEdit');
        const oldRow = data[rowIndex];
        const oldValue = oldRow[columnId as keyof StudentRow];

        // Optimistic update
        const newRow = { ...oldRow, [columnId]: value };
        if (columnId.startsWith('ex')) {
          computeAggregates(newRow);
        }
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
    } satisfies TableMeta,
  });

  // End sort measure after re-render
  const sortRef = useRef(sorting);
  useEffect(() => {
    if (sortRef.current !== sorting) {
      sortRef.current = sorting;
      endMeasure('lastSort');
    }
  }, [sorting, endMeasure]);

  // End filter measure after re-render
  const filterRef = useRef(globalFilter);
  useEffect(() => {
    if (filterRef.current !== globalFilter) {
      filterRef.current = globalFilter;
      endMeasure('lastFilter');
    }
  }, [globalFilter, endMeasure]);

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const { rows: tableRows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 20,
  });

  // Measure initial render
  useEffect(() => {
    if (!mountTime.current) mountTime.current = performance.now();
    if (initialMeasured.current) return;
    initialMeasured.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMetric('initialRender', performance.now() - mountTime.current);
      });
    });
  }, [setMetric]);

  return (
    <div className="tanstack-page">
      <PerformancePanel
        metrics={metrics}
        gridName="TanStack Table"
        flashRef={flashRef}
        renderCountElRef={renderCountElRef}
        renderTimeElRef={renderTimeElRef}
      />
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search student names..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <span className="row-count">
          {tableRows.length.toLocaleString()} rows
        </span>
      </div>
      <div ref={parentRef} className="table-scroll-container">
        <table className="ts-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' \u25B2'
                      : header.column.getIsSorted() === 'desc'
                        ? ' \u25BC'
                        : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  className={row.getIsSelected() ? 'row-selected' : ''}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={
                        selectedCell?.rowId === row.id &&
                        selectedCell?.colId === cell.column.id
                          ? 'cell-selected'
                          : ''
                      }
                      onClick={() =>
                        setSelectedCell({ rowId: row.id, colId: cell.column.id })
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

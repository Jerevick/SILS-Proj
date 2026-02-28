"use client";

/**
 * Dashboard DataGrid — MUI DataGrid with dark theme for tenant dashboards.
 * Use where tabular data is needed (e.g. recent enrollments, key records).
 */

import {
  ThemeProvider,
  createTheme,
  Box,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridValidRowModel } from "@mui/x-data-grid";

const dashboardDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.6)" },
  },
  typography: { fontFamily: "var(--font-display), system-ui, sans-serif" },
});

const gridSx = {
  minHeight: 280,
  width: "100%",
  "& .MuiDataGrid-root": { border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" },
  "& .MuiDataGrid-cell": { color: "rgba(226,232,240,0.9)" },
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(0,245,255,0.06)" },
  "& .MuiDataGrid-cell:focus": { outline: "none" },
};

export interface DashboardDataGridProps<R extends GridValidRowModel = GridValidRowModel> {
  columns: GridColDef<R>[];
  rows: R[];
  getRowId?: (row: R) => string | number;
  title?: string;
  pageSize?: number;
}

export function DashboardDataGrid<R extends GridValidRowModel = GridValidRowModel>({
  columns,
  rows,
  getRowId,
  title,
  pageSize = 5,
}: DashboardDataGridProps<R>) {
  return (
    <ThemeProvider theme={dashboardDarkTheme}>
      <div>
        {title && (
          <h2 className="font-display text-lg font-semibold text-white mb-3">
            {title}
          </h2>
        )}
        <Box sx={gridSx}>
          <DataGrid
            columns={columns}
            rows={rows}
            getRowId={getRowId ?? ((row: R) => String((row as unknown as { id: string | number }).id))}
            initialState={{ pagination: { paginationModel: { pageSize } } }}
            pageSizeOptions={[5, 10]}
            disableRowSelectionOnClick
            autoHeight
          />
        </Box>
      </div>
    </ThemeProvider>
  );
}

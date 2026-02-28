"use client";

import { Box } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridValidRowModel,
  type DataGridProps,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
} from "@mui/x-data-grid";

const defaultGridSx = {
  minHeight: 360,
  width: "100%",
  "& .MuiDataGrid-root": { border: "1px solid rgba(255,255,255,0.1)" },
  "& .MuiDataGrid-cell": { color: "rgba(226,232,240,0.9)" },
  "& .MuiDataGrid-cell[data-field='actions']": { overflow: "visible" },
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(0,245,255,0.06)" },
  "& .MuiDataGrid-cell:focus": { outline: "none" },
};

function DefaultToolbar() {
  return (
    <GridToolbarContainer
      sx={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        p: 1.5,
        gap: 1,
        flexWrap: "wrap",
        "& .MuiButton-root": { color: "rgba(0,245,255,0.9)" },
      }}
    >
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

export type AdminDataGridProps<R extends GridValidRowModel = GridValidRowModel> = Omit<
  DataGridProps<R>,
  "sx"
> & {
  /** Override default height (default 360) */
  height?: number;
  /** Show toolbar with columns, filter, density, export */
  showToolbar?: boolean;
  /** Merge with default grid sx */
  sx?: DataGridProps<R>["sx"];
};

export function AdminDataGrid<R extends GridValidRowModel = GridValidRowModel>({
  height = 420,
  showToolbar = false,
  sx,
  slots,
  ...dataGridProps
}: AdminDataGridProps<R>) {
  const mergedSx = {
    ...defaultGridSx,
    minHeight: height,
    height,
    ...(typeof sx === "object" && sx !== null ? sx : {}),
  };

  return (
    <Box sx={mergedSx}>
      <DataGrid
        {...dataGridProps}
        slots={{
          ...(showToolbar ? { toolbar: DefaultToolbar } : {}),
          ...slots,
        }}
      />
    </Box>
  );
}

export type { GridColDef, GridValidRowModel, GridRenderCellParams } from "@mui/x-data-grid";

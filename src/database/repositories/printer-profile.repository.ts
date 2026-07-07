import type { DatabaseService } from '../database.service.js';
import type { PrinterProfile } from '../../printer/profiles/printer-profile.types.js';

interface PrinterProfileRow {
  id: string;
  name: string;
  model: string | null;
  paper_width: string;
  default_renderer: string;
  supported_drivers: string;
  encoding: string;
  capabilities: string;
  image_support: number;
  qr_support: number;
  barcode_support: number;
  cash_drawer_support: number;
  cut_support: number;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

function mapRowToProfile(row: PrinterProfileRow): PrinterProfile {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    paperWidth: row.paper_width,
    defaultRenderer: row.default_renderer,
    supportedDrivers: JSON.parse(row.supported_drivers) as string[],
    encoding: row.encoding,
    capabilities: JSON.parse(row.capabilities) as string[],
    imageSupport: row.image_support === 1,
    qrSupport: row.qr_support === 1,
    barcodeSupport: row.barcode_support === 1,
    cashDrawerSupport: row.cash_drawer_support === 1,
    cutSupport: row.cut_support === 1,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All SQL for the `printer_profiles` table — custom (non-builtin) profiles only; built-ins live in code. */
export class PrinterProfileRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  create(profile: PrinterProfile): void {
    this.db
      .prepare(
        `INSERT INTO printer_profiles
           (id, name, model, paper_width, default_renderer, supported_drivers, encoding, capabilities,
            image_support, qr_support, barcode_support, cash_drawer_support, cut_support, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.name,
        profile.model,
        profile.paperWidth,
        profile.defaultRenderer,
        JSON.stringify(profile.supportedDrivers),
        profile.encoding,
        JSON.stringify(profile.capabilities),
        profile.imageSupport ? 1 : 0,
        profile.qrSupport ? 1 : 0,
        profile.barcodeSupport ? 1 : 0,
        profile.cashDrawerSupport ? 1 : 0,
        profile.cutSupport ? 1 : 0,
        profile.isBuiltin ? 1 : 0,
        profile.createdAt,
        profile.updatedAt,
      );
  }

  update(profile: PrinterProfile): void {
    this.db
      .prepare(
        `UPDATE printer_profiles
         SET name = ?, model = ?, paper_width = ?, default_renderer = ?, supported_drivers = ?, encoding = ?,
             capabilities = ?, image_support = ?, qr_support = ?, barcode_support = ?, cash_drawer_support = ?,
             cut_support = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        profile.name,
        profile.model,
        profile.paperWidth,
        profile.defaultRenderer,
        JSON.stringify(profile.supportedDrivers),
        profile.encoding,
        JSON.stringify(profile.capabilities),
        profile.imageSupport ? 1 : 0,
        profile.qrSupport ? 1 : 0,
        profile.barcodeSupport ? 1 : 0,
        profile.cashDrawerSupport ? 1 : 0,
        profile.cutSupport ? 1 : 0,
        profile.updatedAt,
        profile.id,
      );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM printer_profiles WHERE id = ?').run(id);
  }

  findById(id: string): PrinterProfile | undefined {
    const row = this.db.prepare('SELECT * FROM printer_profiles WHERE id = ?').get(id) as PrinterProfileRow | undefined;
    return row ? mapRowToProfile(row) : undefined;
  }

  findAll(): PrinterProfile[] {
    const rows = this.db.prepare('SELECT * FROM printer_profiles ORDER BY created_at ASC').all() as PrinterProfileRow[];
    return rows.map(mapRowToProfile);
  }
}

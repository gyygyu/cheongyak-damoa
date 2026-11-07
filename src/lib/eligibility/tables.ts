// 연도별 소득 기준표 묶음. 해마다 content/income-table/{연도}.json 을 더하고 여기에 한 줄 추가한다.
import t2026 from '../../../content/income-table/2026.json';
import type { IncomeTable } from './income';

export const INCOME_TABLES: readonly IncomeTable[] = [t2026];

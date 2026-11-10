import "server-only";
import { customerRoutes } from "./modules/customers";
import { formRoutes } from "./modules/forms";
import { staffAccountRoutes } from "./modules/staff-accounts";
import { staffCaseRoutes } from "./modules/staff-cases";
import { staffAccessRoutes } from "./modules/staff-access";
import { compile } from "./router";

export const routes = compile({
  ...staffAccessRoutes,
  ...formRoutes,
  ...staffCaseRoutes,
  ...staffAccountRoutes,
  ...customerRoutes,
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../../pages/NotificationsPage.jsx", import.meta.url), "utf8");
const repository = await readFile(new URL("notificationRepository.js", import.meta.url), "utf8");

test("Notifications exposes individual and bulk management through trusted callables", () => { for (const name of ["markAllNotificationsRead", "deleteNotification", "clearNotifications"]) assert.match(repository, new RegExp(name)); assert.match(page, /Mark all as read/); assert.match(page, /Delete all notifications/); });
test("zero unread and empty states use clean copy", () => { assert.match(page, /No unread notifications/); assert.doesNotMatch(page, /0 unread notifications unread/); });

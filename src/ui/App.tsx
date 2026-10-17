import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createId, createEmptyWorkflow, normalizeWorkflow, validateWorkflow, type WorkflowDocument, type WorkflowGroup, type WorkflowVariable, type UserInputField, type StepType, type LocatorStrategy, type OnErrorPolicy, type WorkflowStep } from "../core/workflow";
import { parseRecorderMessage, selectionToLocator, type RecorderSelection } from "../core/recorder";
import { validateSessionSnapshot } from "../core/session";
import { buildWorkflowPackage, importWorkflowPackage, type StoredWorkflow } from "../core/workflowLibrary";
/* Maintainer: Amirreza Taati (Jelofen1962) | https://github.com/Jelofen1962 | https://t.me/Jelofen1962 */
import {
  Activity, AppWindow, ArrowDown, ArrowUp, Braces, Check, ChevronDown, CircleHelp, Clock3, Archive, Eye, Download, RefreshCw,
  Code2, Cookie, Copy, FilePlus2, FolderOpen, Globe2, GripVertical, Layers3, MousePointer2,
  Play, Plus, Save, Settings2, ShieldCheck, Square, Terminal, Trash2, Zap, Search, FileText, BookTemplate, Sun, Moon
} from "./AnimatedIcons";


const faTranslations: Record<string, string> = {
  "Editor": "ویرایشگر",
  "Workflows": "گردش‌کارها",
  "Outputs": "خروجی‌ها",
  "Browser": "مرورگر",
  "Templates": "الگوها",
  "Profiles": "پروفایل‌ها",
  "Settings": "تنظیمات",
  "Run history": "تاریخچه اجرا",
  "Logs": "گزارش‌ها",
  "Commands": "فرمان‌ها",
  "Record": "ضبط",
  "Recording": "در حال ضبط",
  "Run workflow": "اجرای گردش‌کار",
  "Running": "در حال اجرا",
  "Ready": "آماده",
  "Desktop": "رومیزی",
  "LOCAL AUTOMATION ENGINE": "موتور خودکارسازی محلی",
  "Runs locally on your machine": "روی دستگاه شما اجرا می‌شود",
  "AUTOMATION BUILDER": "سازنده خودکارسازی",
  "Workflow": "گردش‌کار",
  "Build repeatable browser tasks, one step at a time.": "کارهای مرورگر را مرحله‌به‌مرحله بسازید و دوباره اجرا کنید.",
  "Workflow name": "نام گردش‌کار",
  "STEPS": "مرحله",
  "SEQUENTIAL": "ترتیبی",
  "Group": "گروه",
  "Find a step…": "جست‌وجوی مرحله…",
  "Add step": "افزودن مرحله",
  "Add user input step": "افزودن مرحله ورودی کاربر",
  "STEP CONFIGURATION": "تنظیم مرحله",
  "Step name": "نام مرحله",
  "Ungrouped": "بدون گروه",
  "Action type": "نوع عملیات",
  "URL": "نشانی اینترنتی",
  "Target locator": "انتخابگر هدف",
  "Record selector": "ضبط انتخابگر",
  "XPath and CSS selectors are supported. Use Record selector to capture a page element.": "انتخابگرهای XPath و CSS پشتیبانی می‌شوند. برای ثبت عنصر صفحه از ضبط انتخابگر استفاده کنید.",
  "Text to type": "متن برای تایپ",
  "Clear field before typing": "پیش از تایپ، فیلد پاک شود",
  "Key / shortcut": "کلید / میان‌بر",
  "Duration (milliseconds)": "مدت‌زمان (میلی‌ثانیه)",
  "Expected text includes": "متن مورد انتظار شامل",
  "Option value": "مقدار گزینه",
  "Output name / variable": "نام خروجی / متغیر",
  "Attribute name": "نام ویژگی",
  "Expected value": "مقدار مورد انتظار",
  "Add another input": "افزودن ورودی دیگر",
  "Required": "الزامی",
  "Hide value in pop-up": "پنهان‌کردن مقدار در پنجره",
  "Run another workflow": "اجرای گردش‌کار دیگر",
  "Save profile": "ذخیره پروفایل",
  "Save profile settings": "ذخیره تنظیمات پروفایل",
  "Browser profiles": "پروفایل‌های مرورگر",
  "Keep browser identity separate between workflows.": "هویت مرورگر را بین گردش‌کارها جدا نگه دارید.",
  "Profile name": "نام پروفایل",
  "Persistent user data directory (optional)": "مسیر پایدار داده‌های کاربر (اختیاری)",
  "PORTABLE SESSION SNAPSHOT": "تصویر قابل‌انتقال نشست",
  "Export session JSON": "خروجی JSON نشست",
  "Import session JSON": "ورود JSON نشست",
  "ENGINE CONFIGURATION": "پیکربندی موتور",
  "Control how the automation engine behaves.": "رفتار موتور خودکارسازی را کنترل کنید.",
  "Disable images": "غیرفعال‌کردن تصاویر",
  "Disable CSS": "غیرفعال‌کردن CSS",
  "Disable web fonts": "غیرفعال‌کردن فونت‌های وب",
  "Disable audio/video": "غیرفعال‌کردن صدا/ویدئو",
  "Page load strategy": "روش بارگذاری صفحه",
  "Close browser after run": "بستن مرورگر پس از اجرا",
  "Default browser": "مرورگر پیش‌فرض",
  "LOCAL WORKFLOW LIBRARY": "کتابخانه محلی گردش‌کار",
  "Create, edit, duplicate, import and share independent workflows. Changes save locally as you edit.": "گردش‌کارهای مستقل را بسازید، ویرایش، تکثیر، وارد و به‌اشتراک بگذارید. تغییرات هنگام ویرایش به‌صورت محلی ذخیره می‌شوند.",
  "Import JSON": "ورود JSON",
  "New workflow": "گردش‌کار جدید",
  "OPEN": "باز",
  "SAVED": "ذخیره‌شده",
  "Continue editing": "ادامه ویرایش",
  "Open & edit": "بازکردن و ویرایش",
  "Duplicate workflow": "تکثیر گردش‌کار",
  "Delete workflow": "حذف گردش‌کار",
  "WORKFLOW ARTIFACTS": "فایل‌های خروجی گردش‌کار",
  "Text, extracted data, screenshots, images and completed downloads are collected into a ZIP for this workflow.": "متن، داده‌های استخراج‌شده، تصاویر صفحه و دانلودهای تکمیل‌شده در یک فایل ZIP برای این گردش‌کار جمع می‌شوند.",
  "Refresh": "بازآوری",
  "CURRENT WORKFLOW": "گردش‌کار فعلی",
  "No output ZIPs yet.": "هنوز فایل ZIP خروجی وجود ندارد.",
  "Open ZIP": "بازکردن ZIP",
  "Show in folder": "نمایش در پوشه",
  "Delete": "حذف",
  "Preview output": "پیش‌نمایش خروجی",
  "DIAGNOSTICS": "عیب‌یابی",
  "Engine logs": "گزارش‌های موتور",
  "Live output from the local Selenium runner.": "خروجی زنده اجراکننده محلی Selenium.",
  "Clear logs": "پاک‌کردن گزارش‌ها",
  "Clear history": "پاک‌کردن تاریخچه",
  "No runs recorded yet. Run a workflow to start building history.": "هنوز اجرایی ثبت نشده است. برای ایجاد تاریخچه یک گردش‌کار اجرا کنید.",
  "Website smoke check": "بررسی سریع وب‌سایت",
  "Form entry starter": "شروع ورود فرم",
  "Search page starter": "شروع جست‌وجوی صفحه",
  "Use template": "استفاده از الگو",
  "Browser & selector": "مرورگر و انتخابگر",
  "Visual record selector": "انتخابگر ضبط بصری",
  "XPath + CSS": "XPath و CSS",
  "Actual browser": "مرورگر واقعی",
  "Local-first": "اولویت با اجرای محلی",
  "Switch to light theme": "تغییر به پوسته روشن",
  "Switch to dark theme": "تغییر به پوسته تیره",
  "Choose language": "انتخاب زبان",
  "English": "انگلیسی",
  "Persian": "فارسی",
  "About FlowForge": "دربارهٔ فلوفورج",
  "Maintainer": "توسعه‌دهنده",
  "Check for updates": "بررسی به‌روزرسانی",
  "Checking for updates…": "در حال بررسی به‌روزرسانی…",
  "You are up to date.": "از آخرین نسخه استفاده می‌کنید.",
  "A new version is available": "نسخهٔ جدید در دسترس است",
  "Current version": "نسخهٔ فعلی",
  "Latest version": "آخرین نسخه",
  "View release": "مشاهدهٔ انتشار",
  "Later": "بعداً",
  "Release notes": "یادداشت‌های انتشار",
  "Could not check for updates.": "بررسی به‌روزرسانی ممکن نشد.",
  "Checks the latest stable release on GitHub.": "آخرین انتشار پایدار را در گیت‌هاب بررسی می‌کند.",
  "Open GitHub profile": "بازکردن نمایهٔ گیت‌هاب",
  "Open Telegram": "بازکردن تلگرام",
  "Search commands…": "جست‌وجوی فرمان‌ها…",
  "COMMAND PALETTE": "فهرست فرمان‌ها",
  "No matching commands.": "فرمانی پیدا نشد.",
  "toggle palette": "باز/بستن فهرست فرمان‌ها",
  "run first match": "اجرای نخستین نتیجه",
  "close": "بستن",
  "Continue workflow": "ادامه گردش‌کار",
  "Cancel workflow step": "لغو مرحله گردش‌کار",
  "FLOWFORGE NEEDS YOUR INPUT": "FlowForge به ورودی شما نیاز دارد",
  "Enter the values below. FlowForge will place each value into its configured webpage field and continue the workflow.": "مقادیر زیر را وارد کنید. FlowForge آن‌ها را در فیلدهای مشخص‌شده صفحه قرار می‌دهد و گردش‌کار را ادامه می‌دهد.",
  "Values are sent only to the local FlowForge engine and are not added to run logs.": "مقادیر فقط به موتور محلی FlowForge فرستاده می‌شوند و در گزارش اجرا ثبت نمی‌شوند.",
  "Open website": "بازکردن وب‌سایت",
  "Wait for heading": "انتظار برای عنوان",
  "Click target": "کلیک روی هدف",
  "Enter text": "واردکردن متن",
  "Group name": "نام گروه",
  "Delete group and ungroup its steps": "حذف گروه و خارج‌کردن مراحل از گروه",
  "Search workflow steps": "جست‌وجوی مراحل گردش‌کار",
  "Move up": "انتقال به بالا",
  "Move down": "انتقال به پایین",
  "Duplicate step": "تکثیر مرحله",
  "Input title": "عنوان ورودی",
  "Placeholder text": "متن جای‌نگهدار",
  "Destination element": "عنصر مقصد",
  "Select a workflow…": "یک گردش‌کار انتخاب کنید…",
  "Text content": "محتوای متن",
  "Remove input": "حذف ورودی",
  "Import workflow": "واردکردن گردش‌کار",
  "Export workflow": "خروجی گرفتن از گردش‌کار",
  "Start visual recorder": "شروع ضبط بصری",
  "Stop recorder": "توقف ضبط",
  "Stop": "توقف",
  "For an earlier action, choose “Previous action result”, select that step ID, then use": "برای ارجاع به یک عملیات قبلی، «نتیجه عملیات قبلی» را انتخاب کنید، شناسه مرحله را برگزینید و سپس از آن استفاده کنید",
  "Headless browser": "مرورگر بدون رابط گرافیکی",
  "Input type": "نوع ورودی",
  "Regex pattern (optional)": "الگوی عبارت منظم (اختیاری)",
  "Run Chrome/Edge without showing a browser window": "اجرای Chrome یا Edge بدون نمایش پنجره مرورگر",
  "runs otherwise.": "در غیر این صورت اجرا می‌شود.",
  "runs when the condition matches.": "هنگامی اجرا می‌شود که شرط مطابقت داشته باشد.",
  "No step selected": "مرحله‌ای انتخاب نشده است",
  "No start URL configured": "نشانی شروع تنظیم نشده است",
  "Workflow files may contain typed values and personal data. Review JSON before sharing. Imported workflow packages remap workflow IDs so their sub-workflow references stay connected.": "فایل‌های گردش‌کار ممکن است شامل مقادیر تایپ‌شده و اطلاعات شخصی باشند. پیش از اشتراک‌گذاری JSON را بررسی کنید. شناسه‌های بسته واردشده برای حفظ پیوند گردش‌کارهای فرعی بازتنظیم می‌شوند.",
  "Lower bandwidth and speed up page loads.": "مصرف اینترنت را کاهش می‌دهد و بارگذاری صفحه را سریع‌تر می‌کند.",
  "Blocks stylesheet requests; may break page layouts.": "درخواست فایل‌های سبک را مسدود می‌کند؛ ممکن است چیدمان صفحه را خراب کند.",
  "Block WOFF/TTF/OTF requests.": "درخواست‌های WOFF/TTF/OTF را مسدود می‌کند.",
  "Block common media file requests.": "درخواست فایل‌های رسانه‌ای رایج را مسدود می‌کند.",
  "Normal · wait for load": "عادی · انتظار برای بارگذاری",
  "Eager · wait for DOM ready": "سریع · انتظار برای آماده‌شدن DOM",
  "None · return immediately": "بدون انتظار · بازگشت فوری",
  "Keep open to inspect results": "برای بررسی نتایج باز بماند",
  "Export or restore cookies and local/session storage for the current site origin. Start a browser session first. Import navigates to the snapshot origin before restoring state.": "کوکی‌ها و فضای ذخیره‌سازی محلی/نشست مبدأ فعلی سایت را صادر یا بازیابی کنید. ابتدا یک نشست مرورگر را شروع کنید. هنگام ورود، ابتدا به مبدأ تصویر نشست می‌رود و سپس وضعیت را بازیابی می‌کند.",
  "Session files contain authentication secrets. They are plain JSON, not encrypted. Store them securely and never commit them to source control. Only one origin is captured per snapshot.": "فایل نشست شامل اطلاعات محرمانه ورود است. این فایل JSON ساده و رمزگذاری‌نشده است. آن را امن نگه دارید و هرگز در مخزن کد قرار ندهید. هر تصویر نشست فقط یک مبدأ را ذخیره می‌کند.",
  "Profile metadata and session snapshots are separate. The snapshot does not include passwords, browser cache, or other origins. Expired cookies are skipped; cookies outside the snapshot host scope are rejected.": "فراداده پروفایل و تصویر نشست جدا هستند. تصویر نشست گذرواژه‌ها، حافظه پنهان مرورگر یا مبدأهای دیگر را شامل نمی‌شود. کوکی‌های منقضی رد می‌شوند و کوکی‌های خارج از محدوده میزبان پذیرفته نمی‌شوند.",
  "Start from a practical pattern, then replace sample URLs and selectors with your own target.": "از یک الگوی کاربردی شروع کنید و سپس نشانی‌ها و انتخابگرهای نمونه را با هدف خود جایگزین کنید.",
  "Open a page, wait for its main heading, and assert expected text. Uses example.com as a safe placeholder.": "صفحه‌ای را باز می‌کند، منتظر عنوان اصلی می‌ماند و متن مورد انتظار را بررسی می‌کند. از example.com به‌عنوان نمونه امن استفاده می‌کند.",
  "Demonstrates waiting for an email field, typing a value, and submitting a form. Update selectors before use.": "انتظار برای فیلد ایمیل، واردکردن مقدار و ارسال فرم را نمایش می‌دهد. پیش از استفاده انتخابگرها را به‌روزرسانی کنید.",
  "Demonstrates locating a search box, entering a query, and pressing Enter. Replace the example selectors.": "پیداکردن کادر جست‌وجو، واردکردن عبارت و فشردن Enter را نمایش می‌دهد. انتخابگرهای نمونه را جایگزین کنید.",
  "Templates are starter examples, not site-specific automations. They may fail until you configure selectors for the website you are authorized to automate.": "الگوها نمونه‌های آغازین هستند و برای سایت خاصی تنظیم نشده‌اند. تا زمانی که انتخابگرهای وب‌سایتی را که مجاز به خودکارسازی آن هستید تنظیم نکنید، ممکن است اجرا نشوند.",
  "Launch a real Chrome or Edge window, then use the selector helper.": "یک پنجره واقعی Chrome یا Edge باز کنید و سپس از ابزار انتخابگر استفاده کنید.",
  "The production selector uses a small browser extension/content script to paint a 40% red hover overlay and capture XPath/CSS when you click an element. This starter UI defines the workflow integration point; the extension bridge still needs to be installed and wired.": "انتخابگر نهایی از افزونه کوچک مرورگر/اسکریپت محتوا برای نمایش لایه قرمز هنگام قرارگیری نشانگر و ثبت XPath/CSS با کلیک استفاده می‌کند. این رابط نقطه اتصال گردش‌کار را تعریف می‌کند؛ اتصال افزونه هنوز باید نصب و یکپارچه شود.",
  "Store a stable locator per action.": "برای هر عملیات یک انتخابگر پایدار ذخیره کنید.",
  "Selenium launches installed Chrome or Edge.": "Selenium نسخه نصب‌شده Chrome یا Edge را اجرا می‌کند.",
  "Workflows and profiles stay on this PC.": "گردش‌کارها و پروفایل‌ها روی همین رایانه باقی می‌مانند.",
  "Recent automation outcomes are stored locally on this device.": "نتایج اخیر خودکارسازی به‌صورت محلی روی این دستگاه ذخیره می‌شوند.",
  "Output archives may contain personal data, screenshots, or downloaded files. Review them before sharing. Preview is limited to 10 MB per file.": "بایگانی خروجی ممکن است شامل اطلاعات شخصی، تصاویر صفحه یا فایل‌های دانلودشده باشد. پیش از اشتراک‌گذاری آن‌ها را بررسی کنید. پیش‌نمایش هر فایل به ۱۰ مگابایت محدود است.",
  "Run this workflow with a screenshot, extract, save-text, or download action to generate output files.": "برای تولید خروجی، این گردش‌کار را با عملیات تصویر صفحه، استخراج، ذخیره متن یا دانلود اجرا کنید.",
  "Workflow to run": "گردش‌کار برای اجرا",
  "Runs the selected workflow inside the current browser session. Sub-workflows can call other workflows, with cycle and depth protection.": "گردش‌کار انتخاب‌شده را در نشست فعلی مرورگر اجرا می‌کند. گردش‌کارهای فرعی می‌توانند گردش‌کارهای دیگر را فراخوانی کنند و محافظت در برابر چرخه و عمق بیش‌ازحد فعال است.",
  "Expected filename contains (optional)": "نام فایل مورد انتظار شامل (اختیاری)",
  "Expected text or value": "متن یا مقدار مورد انتظار",
  "Shown inside the pop-up": "در پنجره بازشو نمایش داده می‌شود",
  "e.g. Account email": "مثلاً ایمیل حساب",
  "Enter a value": "یک مقدار وارد کنید",
  "Selector bridge is not connected yet. See docs/ROADMAP.md.": "اتصال انتخابگر هنوز برقرار نشده است. docs/ROADMAP.md را ببینید.",
  "START URL": "نشانی شروع",
  "BROWSER TARGET": "هدف مرورگر",
  "VARIABLES": "متغیرها",
  "WORKFLOW VARIABLES": "متغیرهای گردش‌کار",
  "OPTIMIZATIONS": "بهینه‌سازی‌ها",
  "ENGINE OUTPUT": "خروجی موتور",
  "EXECUTION DIAGNOSTICS": "عیب‌یابی اجرا",
  "LIVE TARGETING": "هدف‌گیری زنده",
  "IDENTITY & STORAGE": "هویت و ذخیره‌سازی",
  "WORKFLOW LIBRARY": "کتابخانه گردش‌کار",
  "BASIC VALIDATION": "اعتبارسنجی پایه",
  "FORM AUTOMATION": "خودکارسازی فرم",
  "SEARCH AUTOMATION": "خودکارسازی جست‌وجو",
  "FILE UPLOAD": "بارگذاری فایل",
  "LOGIC BLOCK": "بلوک منطقی",
  "LOOP BLOCK": "بلوک حلقه",
  "ITERATION BLOCK": "بلوک تکرار",
  "COLLECT MATCHING ELEMENTS": "جمع‌آوری عناصر منطبق",
  "BULK ACTION": "عملیات گروهی",
  "POP-UP INPUT FIELDS": "فیلدهای ورودی پنجره",
  "Run status": "وضعیت اجرا",
  "steps completed": "مرحله تکمیل‌شده",
  "Succeeded": "موفق",
  "Failed": "ناموفق",
  "Skipped": "ردشده",
  "Changed": "تغییر کرد",
  "Did not change": "تغییری نکرد",
  "True path:": "مسیر درست:",
  "Else path:": "مسیر در غیر این صورت:",
  "Choose an earlier action…": "یک عملیات قبلی انتخاب کنید…",
  "Choose a local file": "انتخاب فایل محلی",
  "Browse": "مرور…",
  "File path": "مسیر فایل",
  "Absolute file path": "مسیر کامل فایل",
  "Variable name": "نام متغیر",
  "Variable / step id": "متغیر / شناسه مرحله",
  "Value": "مقدار",
  "Value to check": "مقدار برای بررسی",
  "Attribute value": "مقدار ویژگی",
  "Visible text": "متن قابل‌مشاهده",
  "Input value": "مقدار ورودی",
  "Operator": "عملگر",
  "equals · success": "برابر · موفق",
  "equals · error": "برابر · خطا",
  "Timeout (ms)": "مهلت زمانی (میلی‌ثانیه)",
  "Retry attempts": "تلاش مجدد",
  "Delay between retries (ms)": "تأخیر بین تلاش‌ها (میلی‌ثانیه)",
  "On error": "در صورت خطا",
  "Continue to next step": "ادامه به مرحله بعد",
  "Stop workflow": "توقف گردش‌کار",
  "Set a variable": "تنظیم متغیر",
  "Repeat N times": "تکرار به تعداد N",
  "Repeat while true": "تکرار تا زمانی که شرط برقرار است",
  "For each item": "برای هر مورد",
  "Number of iterations (1 to 1,000)": "تعداد تکرار (۱ تا ۱۰۰۰)",
  "Maximum iterations (safety cap)": "حداکثر تکرار (محدودیت ایمنی)",
  "List values or JSON array": "مقادیر فهرست یا آرایه JSON",
  "Item variable name": "نام متغیر مورد",
  "Run a sequence a fixed number of times.": "یک توالی را به تعداد مشخص اجرا می‌کند.",
  "Run a sequence for every value in your list.": "یک توالی را برای هر مقدار فهرست اجرا می‌کند.",
  "Run actions until the condition no longer passes.": "عملیات را تا زمانی اجرا می‌کند که شرط دیگر برقرار نباشد.",
  "The condition is checked before each iteration. A safety cap prevents an endless loop.": "شرط پیش از هر تکرار بررسی می‌شود. سقف ایمنی از حلقه بی‌پایان جلوگیری می‌کند.",
  "Every action in the loop body runs in order for each iteration.": "هر عملیات داخل بدنه حلقه در هر تکرار به‌ترتیب اجرا می‌شود.",
  "The current value is exposed through the item variable while the loop body runs.": "مقدار فعلی هنگام اجرای بدنه حلقه از طریق متغیر مورد در دسترس است.",
  "Select all matching elements": "انتخاب همه عناصر منطبق",
  "Collect text into a variable": "جمع‌آوری متن در متغیر",
  "Collect attribute into a variable": "جمع‌آوری ویژگی در متغیر",
  "Collect input values into a variable": "جمع‌آوری مقدار فیلدها در متغیر",
  "Save array to variable": "ذخیره آرایه در متغیر",
  "Operate on every match": "اجرا روی همه موارد منطبق",
  "Click each match": "کلیک روی همه موارد",
  "Type into each match": "تایپ در همه موارد",
  "Apply one operation to all elements matched by the locator.": "یک عملیات را روی تمام عناصر منطبق با انتخابگر اجرا کنید.",
  "Collect every matching element into a JSON array variable and a .json output artifact.": "تمام عناصر منطبق را در متغیر آرایه JSON و فایل خروجی ‎.json جمع‌آوری می‌کند.",
  "Bulk click/type is limited to 1,000 elements. Test your selector with a small set first.": "کلیک/تایپ گروهی به ۱۰۰۰ عنصر محدود است. ابتدا انتخابگر را روی مجموعه کوچکی آزمایش کنید.",
  "Downloads are routed to this workflow's output folder and included in the ZIP.": "دانلودها به پوشه خروجی این گردش‌کار منتقل و در ZIP قرار می‌گیرند.",
  "The path stays on this computer until the workflow uploads it to the website.": "مسیر فایل تا زمانی که گردش‌کار آن را در وب‌سایت بارگذاری کند، روی همین رایانه باقی می‌ماند.",
  "FlowForge sends the file path to the page's file input.": "FlowForge مسیر فایل را به فیلد بارگذاری صفحه می‌فرستد.",
  "Choose the file input as the target locator. The path stays on this computer until the workflow uploads it to the website.": "فیلد انتخاب فایل را به‌عنوان انتخابگر هدف تعیین کنید. مسیر تا زمان بارگذاری توسط گردش‌کار روی همین رایانه باقی می‌ماند.",
  "Branch on extracted text, URL changes, or whether an earlier action succeeded. For failed actions, set Error handling to Continue so the Else path can run.": "بر اساس متن استخراج‌شده، تغییر نشانی یا موفقیت عملیات قبلی شاخه‌بندی کنید. برای اجرای مسیر Else پس از خطا، مدیریت خطا را روی ادامه تنظیم کنید.",
  "To route a failed action into Else, set that action’s error handling to Continue.": "برای هدایت خطای عملیات به مسیر Else، مدیریت خطای همان عملیات را روی ادامه تنظیم کنید.",
  "Start a workflow or run the sample steps.": "یک گردش‌کار بسازید یا مراحل نمونه را اجرا کنید.",
  "Create a workflow or run the sample steps.": "یک گردش‌کار بسازید یا مراحل نمونه را اجرا کنید.",
  "Add an action to define what happens here.": "برای تعیین رفتار این بخش، یک عملیات اضافه کنید.",
  "Add a step to begin building your workflow.": "برای ساخت گردش‌کار، یک مرحله اضافه کنید.",
  "No actions in this branch yet.": "هنوز عملیاتی در این شاخه وجود ندارد.",
  "Choose the action to create when you select an element": "هنگام انتخاب عنصر، عملیات موردنظر برای ساخت را انتخاب کنید",
  "Record click": "ضبط کلیک",
  "Record hover": "ضبط شناورشدن نشانگر",
  "Record wait": "ضبط انتظار",
  "Record text extraction": "ضبط استخراج متن",
  "Record existence check": "ضبط بررسی وجود عنصر",
  "Open command palette": "بازکردن فهرست فرمان‌ها",
  "Open editor": "بازکردن ویرایشگر",
  "Open workflows": "بازکردن گردش‌کارها",
  "Open outputs": "بازکردن خروجی‌ها",
  "Open browser": "بازکردن مرورگر",
  "Open templates": "بازکردن الگوها",
  "Open profiles": "بازکردن پروفایل‌ها",
  "Open settings": "بازکردن تنظیمات",
  "Open run history": "بازکردن تاریخچه اجرا",
  "Open logs": "بازکردن گزارش‌ها",
  "Search commands": "جست‌وجوی فرمان‌ها",
  "Clear": "پاک‌کردن",
  "Add": "افزودن",
  "Capture selected element": "ثبت عنصر انتخاب‌شده",
  "ENGINE ONLINE": "موتور فعال است",
  "Real desktop browser": "مرورگر واقعی دسکتاپ",
  "Export workflow and referenced sub-workflows": "خروجی گردش‌کار و گردش‌کارهای فرعی مرتبط",
  "View this workflow's output ZIPs": "مشاهده فایل‌های ZIP خروجی این گردش‌کار",
  "Navigate to URL": "رفتن به نشانی",
  "Click element": "کلیک روی عنصر",
  "Type text": "تایپ متن",
  "Keyboard shortcut": "میان‌بر صفحه‌کلید",
  "Hover over element": "قرار دادن نشانگر روی عنصر",
  "Right-click element": "کلیک راست روی عنصر",
  "Double-click element": "دوبار کلیک روی عنصر",
  "Drag and drop": "کشیدن و رهاکردن",
  "Scroll to element": "رفتن به عنصر با پیمایش",
  "Scroll page": "پیمایش صفحه",
  "Wait until visible": "انتظار تا قابل‌مشاهده‌شدن",
  "Wait until clickable": "انتظار تا قابل‌کلیک‌شدن",
  "Wait / pause": "انتظار / مکث",
  "Wait for download": "انتظار برای دانلود",
  "Assert text": "بررسی متن",
  "Assert URL": "بررسی نشانی",
  "Assert element exists": "بررسی وجود عنصر",
  "Assert element count": "بررسی تعداد عناصر",
  "Assert page title": "بررسی عنوان صفحه",
  "Assert attribute": "بررسی ویژگی",
  "Select option": "انتخاب گزینه",
  "Upload file": "بارگذاری فایل",
  "Extract element text": "استخراج متن عنصر",
  "Extract attribute": "استخراج ویژگی",
  "Extract input value": "استخراج مقدار ورودی",
  "Extract table to CSV": "استخراج جدول به CSV",
  "Save text output": "ذخیره خروجی متنی",
  "Save image from element": "ذخیره تصویر عنصر",
  "Take screenshot": "گرفتن تصویر صفحه",
  "Accept browser alert": "پذیرفتن هشدار مرورگر",
  "Dismiss browser alert": "رد هشدار مرورگر",
  "Open new tab": "بازکردن زبانه جدید",
  "Close current tab": "بستن زبانه فعلی",
  "Switch browser tab": "تغییر زبانه مرورگر",
  "Switch into frame": "رفتن به فریم",
  "Return to main page from frame": "بازگشت از فریم به صفحه اصلی",
  "Set variable": "تنظیم متغیر",
  "Extract all matching elements": "استخراج همه عناصر منطبق",
  "Operate on all matching elements": "عملیات روی همه عناصر منطبق",
  "If / else block": "بلوک اگر / در غیر این صورت",
  "Repeat steps": "تکرار مراحل",
  "Loop over list": "حلقه روی فهرست",
  "While condition is true": "تا زمانی که شرط درست است",
  "Break loop": "خروج از حلقه",
  "Continue loop": "ادامه حلقه",
  "Ask user for inputs": "دریافت ورودی از کاربر",
  "Go back": "بازگشت",
  "Go forward": "رفتن به جلو",
  "Refresh page": "بازآوری صفحه",
  "New step": "مرحله جدید",
  "Run automation": "اجرای خودکارسازی",
  "Automation running": "خودکارسازی در حال اجرا",
  "Automation builder": "سازنده خودکارسازی",
  "If / else": "اگر / در غیر این صورت",
  "Add variable": "افزودن متغیر",
  "Destination locator": "انتخابگر مقصد",
  "Destination locator strategy": "روش انتخابگر مقصد",
  "Disable fonts": "غیرفعال‌کردن فونت‌ها",
  "Disable media": "غیرفعال‌کردن رسانه‌ها",
  "Disable this step": "غیرفعال‌کردن این مرحله",
  "Experimental, may break layouts": "آزمایشی؛ ممکن است چیدمان را مختل کند",
  "Each successful or failed run attempts to create a separate ZIP archive in FlowForge's local application data folder.": "هر اجرای موفق یا ناموفق تلاش می‌کند یک فایل ZIP جداگانه در پوشه داده‌های محلی FlowForge ایجاد کند.",
  "Extracted values become workflow variables and artifacts in this workflow's output ZIP.": "مقادیر استخراج‌شده به متغیرهای گردش‌کار و فایل‌های خروجی ZIP آن تبدیل می‌شوند.",
  "For persistent cookies and storage, use a dedicated automation profile directory. Do not point this at a browser profile that is currently open.": "برای نگهداری کوکی‌ها و فضای ذخیره‌سازی از پوشه اختصاصی پروفایل خودکارسازی استفاده کنید. آن را به پروفایل مرورگری که باز است متصل نکنید.",
  "Reduce bandwidth and page load": "کاهش مصرف اینترنت و زمان بارگذاری صفحه",
  "Scroll distance (pixels)": "میزان پیمایش (پیکسل)",
  "Scrolls the selected element into the center of the viewport before continuing.": "پیش از ادامه، عنصر انتخاب‌شده را در مرکز نمای صفحه قرار می‌دهد.",
  "Selenium key names are supported, e.g. ENTER, TAB, ESCAPE.": "نام کلیدهای Selenium پشتیبانی می‌شوند؛ مانند ENTER، TAB و ESCAPE.",
  "Save results to variable": "ذخیره نتایج در متغیر",
  "This file type cannot be previewed in the app. Open the ZIP to inspect it.": "پیش‌نمایش این نوع فایل در برنامه ممکن نیست. برای بررسی، ZIP را باز کنید.",
  "Store text or a value built from existing variables. Use ${variableName} to reference another variable.": "متن یا مقداری ساخته‌شده از متغیرهای موجود را ذخیره کنید. برای ارجاع به متغیر دیگر از ${variableName} استفاده کنید.",
  "Tab index (zero-based)": "شماره زبانه (شروع از صفر)",
  "When this step runs, FlowForge opens a dialog for the user. Each answer is typed into its mapped webpage element.": "هنگام اجرای این مرحله، FlowForge پنجره‌ای برای کاربر باز می‌کند و هر پاسخ را در عنصر متناظر صفحه تایپ می‌کند.",
  "Uses the locator above. CSS examples:": "از انتخابگر بالا استفاده می‌کند. نمونه‌های CSS:",
  "Variables persist with this workflow. Reference values in text fields with": "متغیرها همراه این گردش‌کار ذخیره می‌شوند. در فیلدهای متن با این قالب به مقادیر ارجاع دهید:",
  "Close WebDriver session when the workflow finishes.": "پس از پایان گردش‌کار، نشست WebDriver را ببند.",
  "Operation": "عملیات",
  "Extract": "استخراج",
  "Select a local file": "انتخاب فایل محلی",
  "Google Chrome": "گوگل کروم",
  "Microsoft Edge": "مایکروسافت اج",
  "Chrome": "کروم",
  "Edge": "اج",
  "FlowForge engine ready.": "موتور FlowForge آماده است.",
  "Previous action result": "نتیجه عملیات قبلی",
  "URL changed": "نشانی تغییر کرده است",
  "URL did not change": "نشانی تغییر نکرده است",
  "Step result": "نتیجه مرحله",
  "Last extracted text": "آخرین متن استخراج‌شده",
  "If condition is true": "اگر شرط درست باشد",
  "Otherwise": "در غیر این صورت",
  "Loop body": "بدنه حلقه",
  "Actions to repeat": "مراحل برای تکرار",
  "Workflow variable": "متغیر گردش‌کار",
  "Current URL": "نشانی فعلی",
  "Did the URL change?": "آیا نشانی تغییر کرد؟",
  "equals": "برابر است",
  "notEquals": "برابر نیست",
  "contains": "شامل است",
  "notContains": "شامل نیست",
  "matches": "منطبق است",
  "greaterThan": "بزرگ‌تر از",
  "lessThan": "کوچک‌تر از",
  "truthy": "درست/دارای مقدار",
  "falsy": "نادرست/بدون مقدار",
  "Block web font files": "مسدودکردن فایل‌های فونت وب",
  "Block audio and video files": "مسدودکردن فایل‌های صوتی و تصویری",
  "Hover target preview": "پیش‌نمایش هدف نشانگر",
  "Started": "شروع شد",
  "In progress": "در حال اجرا",
  "succeeded": "موفق",
  "failed": "ناموفق",
  "skipped": "ردشده",
  "success": "موفق",
  "running": "در حال اجرا",
  "stopped": "متوقف‌شده",
  "interrupted": "قطع‌شده",
  "total": "مجموع",
  "Selenium WebDriver": "Selenium WebDriver",
  "Collapse workflow steps": "جمع‌کردن مراحل گردش‌کار",
  "Expand workflow steps": "بازکردن مراحل گردش‌کار",
  "Collapse run status": "جمع‌کردن وضعیت اجرا",
  "Expand run status": "بازکردن وضعیت اجرا",
  "Resize workflow steps panel": "تغییر اندازه پنل مراحل گردش‌کار",
  "Resize run status panel": "تغییر اندازه پنل وضعیت اجرا",
  "Delete step": "حذف مرحله",
  "Add group": "افزودن گروه",
  "No matching steps": "مرحله‌ای پیدا نشد",
  "Step settings": "تنظیمات مرحله",
  "Error handling": "مدیریت خطا",
  "Stop on error": "توقف هنگام خطا",
  "Continue on error": "ادامه پس از خطا",
  "Save changes": "ذخیره تغییرات",
  "Cancel": "لغو",
  "Close": "بستن",
  "Back": "بازگشت",
  "Next": "بعدی",
  "Search": "جست‌وجو",
  "Name": "نام",
  "Description": "توضیحات",
  "Status": "وضعیت",
  "Actions": "عملیات",
  "Created": "زمان ایجاد",
  "Updated": "آخرین تغییر",
  "Duration": "مدت‌زمان",
  "Success": "موفق",
  "Stopped": "متوقف‌شده",
  "Interrupted": "قطع‌شده",
  "Run": "اجرا",
  "Copy": "کپی",
  "Copied": "کپی شد",
  "Open": "بازکردن",
  "Select file": "انتخاب فایل",
  "No file selected": "فایلی انتخاب نشده است",
  "Choose browser": "انتخاب مرورگر",
  "Headless mode": "حالت بدون رابط گرافیکی",
  "Performance": "کارایی",
  "General": "عمومی",
  "Appearance": "ظاهر",
  "Language": "زبان",
  "Theme": "پوسته",
  "Dark": "تیره",
  "Light": "روشن",
  "Save locally": "ذخیره محلی",
  "Saved locally": "به‌صورت محلی ذخیره شد",
  "Local save failed": "ذخیره‌سازی محلی ناموفق بود",
  "Workflow saved": "گردش‌کار ذخیره شد",
  "Duplicate": "تکثیر",
  "Rename": "تغییر نام",
  "Are you sure?": "آیا مطمئن هستید؟",
  "This action cannot be undone.": "این عملیات قابل بازگشت نیست.",
  "No workflows yet. Create your first workflow to get started.": "هنوز گردش‌کاری ندارید. برای شروع اولین گردش‌کار خود را بسازید.",
  "Workflow validation": "اعتبارسنجی گردش‌کار",
  "Valid workflow": "گردش‌کار معتبر است",
  "Validation errors": "خطاهای اعتبارسنجی",
  "Warnings": "هشدارها",
  "Required field": "تکمیل این فیلد الزامی است",
  "Invalid URL": "نشانی اینترنتی معتبر نیست",
  "Enter a valid URL": "یک نشانی اینترنتی معتبر وارد کنید",
  "Target selector": "انتخابگر هدف",
  "CSS selector": "انتخابگر CSS",
  "XPath selector": "انتخابگر XPath",
  "Extract text": "استخراج متن",
  "Regex edit variable": "ویرایش متغیر با عبارت منظم",
  "Regex pattern": "الگوی عبارت منظم",
  "Replacement": "متن جایگزین",
  "Flags": "پرچم‌ها",
  "Output name": "نام خروجی",
  "Output variable": "متغیر خروجی",
  "Workflow details": "جزئیات گردش‌کار",
  "Browser settings": "تنظیمات مرورگر",
  "Run settings": "تنظیمات اجرا",
  "Export JSON": "برون‌بری JSON",
  "Workflow artifacts": "فایل‌های خروجی گردش‌کار",
  "Output files": "فایل‌های خروجی",
};
const translate = (language: "en" | "fa", text: string) => language === "fa" ? (faTranslations[text] || text) : text;

type Target = { strategy: LocatorStrategy; value: string };
type Step = WorkflowStep & { target: Target };
type OutputArchive = { name:string; path:string; size:number; modifiedAt:string; workflowName:string; runId:string; artifacts:Array<{name:string;contentType:string;size:number;createdAt:string}> };
type UserInputPrompt = { requestId:string; stepName:string; fields:Array<{id:string;title:string;placeholder:string;required:boolean;secret:boolean;valueType?:"text"|"number"|"boolean";pattern?:string}>; values:Record<string,string>; error?:string };
type RunRecord = { id:string; workflow:string; startedAt:string; endedAt?:string; status:"running"|"success"|"failed"|"stopped"|"interrupted"; totalSteps:number; successfulSteps:number; failedSteps:number; skippedSteps:number; error?:string; durationMs?:number };
const makeStep = (type:StepType="click"):Step => ({ id:crypto.randomUUID(), name: ({navigate:"Navigate to URL",click:"Click element",type:"Type text",key:"Keyboard shortcut",hover:"Hover over element",rightClick:"Right-click element",doubleClick:"Double-click element",dragDrop:"Drag and drop",scrollTo:"Scroll to element",scroll:"Scroll page",waitVisible:"Wait until visible",waitClickable:"Wait until clickable",wait:"Wait / pause",waitDownload:"Wait for download",assertText:"Assert text",assertUrl:"Assert URL",assertExists:"Assert element exists",assertCount:"Assert element count",assertTitle:"Assert page title",assertAttribute:"Assert attribute",select:"Select option",uploadFile:"Upload file",extractText:"Extract element text",extractAttribute:"Extract attribute",extractValue:"Extract input value",extractTable:"Extract table to CSV",saveText:"Save text output",saveImage:"Save image from element",screenshot:"Take screenshot",saveSession:"Save browser session",alertAccept:"Accept browser alert",alertDismiss:"Dismiss browser alert",openTab:"Open new tab",closeTab:"Close current tab",switchWindow:"Switch browser tab",switchFrame:"Switch into frame",switchFrameDefault:"Return to main page from frame",ifElse:"If / else block",repeat:"Repeat steps",loopList:"Loop over list",while:"While condition is true",breakLoop:"Break loop",continueLoop:"Continue loop",setVariable:"Set variable",regexReplace:"Regex edit variable",extractAll:"Extract all matching elements",operateAll:"Operate on all matching elements",userInput:"Ask user for inputs",runWorkflow:"Run another workflow"} as Record<string,string>)[type] || "New step", type, target:{strategy:"css",value:""}, target2:type==="dragDrop"?{strategy:"css",value:""}:undefined, url:"https://example.com", text:"", key:"ENTER", ms:1000, timeout:10000, onError:"stop", clearFirst:true, attribute:["extractAttribute","assertAttribute"].includes(type)?"href":undefined, outputName:["extractText","extractAttribute","extractValue","extractTable","saveText","saveImage","screenshot","extractAll","setVariable","regexReplace"].includes(type)?"result":undefined, bulkOperation:type==="operateAll"?"click":undefined, scrollAmount:type==="scroll"?600:undefined, repeatCount:type==="repeat"?2:type==="while"?100:undefined, listExpression:type==="loopList"?"one,two,three":undefined, itemVariable:type==="loopList"?"item":undefined, condition:["ifElse","while"].includes(type)?{source:"lastText",operator:"contains",expected:""}:undefined, thenSteps:type==="ifElse"?[]:undefined, elseSteps:type==="ifElse"?[]:undefined, loopSteps:["repeat","loopList","while"].includes(type)?[]:undefined, inputs:type==="userInput"?[{id:crypto.randomUUID(),title:"Value",placeholder:"Enter a value",required:true,secret:false,valueType:"text",target:{strategy:"css",value:""}}]:undefined });
const starter:Step[] = [
  {...makeStep("navigate"), name:"Open website", url:"https://example.com"},
  {...makeStep("waitVisible"), name:"Wait for heading", target:{strategy:"css",value:"h1"}, timeout:10000},
  {...makeStep("click"), name:"Click target", target:{strategy:"xpath",value:"//button[normalize-space()='Continue']"}},
  {...makeStep("type"), name:"Enter text", target:{strategy:"css",value:"input[name='email']"}, text:"hello@example.com"}
];
const stepTypes: [StepType,string][] = [
  ["navigate","Navigate to URL"],["click","Click element"],["type","Type text"],["key","Keyboard shortcut"],
  ["hover","Hover over element"],["rightClick","Right-click element"],["doubleClick","Double-click element"],["dragDrop","Drag and drop"],["scrollTo","Scroll to element"],["scroll","Scroll page"],
  ["waitVisible","Wait until visible"],["waitClickable","Wait until clickable"],["wait","Wait / pause"],["waitDownload","Wait for download"],
  ["assertText","Assert text"],["assertUrl","Assert URL"],["assertExists","Assert element exists"],["assertCount","Assert element count"],["assertTitle","Assert page title"],["assertAttribute","Assert attribute"],
  ["select","Select option"],["uploadFile","Upload file"],["extractText","Extract element text"],["extractAttribute","Extract attribute"],["extractValue","Extract input value"],["extractTable","Extract table to CSV"],["saveText","Save text output"],["saveImage","Save image from element"],["screenshot","Take screenshot"],["saveSession","Save browser session"],
  ["alertAccept","Accept browser alert"],["alertDismiss","Dismiss browser alert"],["openTab","Open new tab"],["closeTab","Close current tab"],["switchWindow","Switch browser tab"],["switchFrame","Switch into frame"],["switchFrameDefault","Return to main page from frame"],
  ["setVariable","Set variable"],["regexReplace","Regex edit variable"],["extractAll","Extract all matching elements"],["operateAll","Operate on all matching elements"],["ifElse","If / else block"],["repeat","Repeat steps"],["loopList","Loop over list"],["while","While condition is true"],["breakLoop","Break loop"],["continueLoop","Continue loop"],["userInput","Ask user for inputs"],["runWorkflow","Run another workflow"],["back","Go back"],["forward","Go forward"],["refresh","Refresh page"]
];
export default function App(){
  const [steps,setSteps]=useState<Step[]>(starter);
  const [workflowName,setWorkflowName]=useState("Untitled workflow");
  const [workflowId,setWorkflowId]=useState(()=>createId());
  const [workflowLibrary,setWorkflowLibrary]=useState<StoredWorkflow[]>([]);
  const [libraryReady,setLibraryReady]=useState(false);
  const [groups,setGroups]=useState<WorkflowGroup[]>([]);
  const [variables,setVariables]=useState<WorkflowVariable[]>([]);
  const [saveState,setSaveState]=useState("Saved locally");
  const [selected,setSelected]=useState(starter[0].id);
  const [tab,setTab]=useState("workflow");
  const [theme,setTheme]=useState<"dark"|"light">(()=>{try{return localStorage.getItem("flowforge.theme.v1")==="light"?"light":"dark"}catch{return "dark"}});
  const [language,setLanguage]=useState<"en"|"fa">(()=>{try{return localStorage.getItem("flowforge.language.v1")==="fa"?"fa":"en"}catch{return "en"}});
  const [stepsWidth,setStepsWidth]=useState(()=>{try{return Math.min(420,Math.max(230,Number(localStorage.getItem("flowforge.stepsWidth.v1"))||282))}catch{return 282}});
  const [rightWidth,setRightWidth]=useState(()=>{try{return Math.min(420,Math.max(250,Number(localStorage.getItem("flowforge.rightWidth.v1"))||320))}catch{return 320}});
  const [stepsCollapsed,setStepsCollapsed]=useState(false);
  const [rightCollapsed,setRightCollapsed]=useState(false);
  const resizeRef=useRef<{side:"steps"|"right";startX:number;startWidth:number}|null>(null);
  const t=(text:string)=>translate(language,text);
  const dateLocale=language === "fa" ? "fa-IR" : "en-US";
  const [commandOpen,setCommandOpen]=useState(false);
  const [updateInfo,setUpdateInfo]=useState<{available:boolean;currentVersion?:string;latestVersion?:string;releaseName?:string;notes?:string;url?:string;error?:string}|null>(null);
  const [updateChecking,setUpdateChecking]=useState(false);
  const [updateMessage,setUpdateMessage]=useState("");
  const [userInputPrompt,setUserInputPrompt]=useState<UserInputPrompt|null>(null);
  const [commandQuery,setCommandQuery]=useState("");
  const commandInputRef=useRef<HTMLInputElement|null>(null);
  const [browser,setBrowser]=useState("chrome");
  const [startUrl,setStartUrl]=useState("https://example.com");
  const [disableImages,setDisableImages]=useState(false);
  const [headless,setHeadless]=useState(false);
  const [disableCss,setDisableCss]=useState(false);
  const [disableFonts,setDisableFonts]=useState(false);
  const [disableMedia,setDisableMedia]=useState(false);
  const [pageLoadStrategy,setPageLoadStrategy]=useState("normal");
  const [closeBrowser,setCloseBrowser]=useState(false);
  const [scheduleEnabled,setScheduleEnabled]=useState(()=>{try{return localStorage.getItem("flowforge.schedule.enabled.v1")==="true"}catch{return false}});
  const [scheduleEvery,setScheduleEvery]=useState(()=>{try{return Math.max(1,Number(localStorage.getItem("flowforge.schedule.every.v1"))||5)}catch{return 5}});
  const [scheduleUnit,setScheduleUnit]=useState(()=>{try{return localStorage.getItem("flowforge.schedule.unit.v1")||"minutes"}catch{return "minutes"}});
  const [scheduleStartup,setScheduleStartup]=useState(()=>{try{return localStorage.getItem("flowforge.schedule.startup.v1")==="true"}catch{return false}});
  const [profileName,setProfileName]=useState("Default profile");
  const [userDataDir,setUserDataDir]=useState("");
  const [running,setRunning]=useState(false);
  const [recording,setRecording]=useState(false);
  const [recorderAction,setRecorderAction]=useState<"click"|"hover"|"waitVisible"|"extractText"|"assertExists">("click");
  const [recordUrl,setRecordUrl]=useState("https://example.com");
  const [logs,setLogs]=useState<string[]>(["FlowForge engine ready.", "Create a workflow or run the sample steps."]);
  const [runState,setRunState]=useState<Record<string,string>>({});
  const [runHistory,setRunHistory]=useState<RunRecord[]>(()=>{try{return JSON.parse(localStorage.getItem("flowforge.runHistory.v1")||"[]").slice(0,50)}catch{return []}});
  const [outputArchives,setOutputArchives]=useState<OutputArchive[]>([]);
  const [outputRefreshToken,setOutputRefreshToken]=useState(0);
  const [outputPreview,setOutputPreview]=useState<{archive:string;name:string;mime:string;data:string;text?:string}|null>(null);
  const [stepSearch,setStepSearch]=useState("");
  const activeRunId=useRef<string|null>(null);
  const current=steps.find(s=>s.id===selected) || steps[0];
  const workflowDocument = useMemo(() => ({version:1 as const,name:workflowName,startUrl,browser:browser as "chrome"|"edge",steps,groups,variables}), [workflowName,startUrl,browser,steps,groups,variables]);
  const validation = useMemo(() => validateWorkflow(workflowDocument), [workflowDocument]);
  useEffect(()=>{try{localStorage.setItem("flowforge.theme.v1",theme)}catch{}},[theme]);
  useEffect(()=>{try{localStorage.setItem("flowforge.language.v1",language)}catch{}},[language]);
  useEffect(()=>{try{localStorage.setItem("flowforge.stepsWidth.v1",String(stepsWidth));localStorage.setItem("flowforge.rightWidth.v1",String(rightWidth))}catch{}},[stepsWidth,rightWidth]);
  useEffect(()=>{
    const move=(event:MouseEvent)=>{const active=resizeRef.current;if(!active)return;const delta=event.clientX-active.startX;const rtl=language==="fa";const direction=active.side==="steps"?(rtl?-1:1):(rtl?1:-1);const next=Math.max(active.side==="steps"?230:250,Math.min(440,active.startWidth+delta*direction));if(active.side==="steps")setStepsWidth(next);else setRightWidth(next)};
    const up=()=>{resizeRef.current=null;document.body.classList.remove("is-resizing-panel")};
    window.addEventListener("mousemove",move);window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",move);window.removeEventListener("mouseup",up)};
  },[language]);
  const beginResize=(side:"steps"|"right",event:ReactMouseEvent<HTMLDivElement>,width:number)=>{event.preventDefault();resizeRef.current={side,startX:event.clientX,startWidth:width};document.body.classList.add("is-resizing-panel")};
  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language === "fa" ? "rtl" : "ltr"},[language]);
  useEffect(()=>{
    let entries:StoredWorkflow[]=[];
    try {
      const rawLibrary=localStorage.getItem("flowforge.workflows.v1");
      if(rawLibrary){
        const parsed=JSON.parse(rawLibrary);
        if(Array.isArray(parsed)) entries=parsed.map((item:any)=>({id:typeof item.id==="string"&&item.id?item.id:createId(),document:normalizeWorkflow(item.document),updatedAt:typeof item.updatedAt==="string"?item.updatedAt:new Date().toISOString()}));
      }
    } catch { entries=[]; }
    if(!entries.length){
      let initial:WorkflowDocument;
      try { const legacy=localStorage.getItem("flowforge.workflow.v1"); initial=legacy?normalizeWorkflow(JSON.parse(legacy)):{...createEmptyWorkflow(),name:"Website smoke check",steps:starter as unknown as WorkflowDocument["steps"]}; }
      catch { initial={...createEmptyWorkflow(),name:"Website smoke check",steps:starter as unknown as WorkflowDocument["steps"]}; }
      const id=createId(); entries=[{id,document:initial,updatedAt:new Date().toISOString()}];
    }
    const chosen=entries[0];
    setWorkflowLibrary(entries); setWorkflowId(chosen.id); setWorkflowName(chosen.document.name); setStartUrl(chosen.document.startUrl); setBrowser(chosen.document.browser); setSteps(chosen.document.steps as unknown as Step[]); setGroups(chosen.document.groups); setVariables(chosen.document.variables); setSelected(chosen.document.steps[0]?.id||""); setLibraryReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    if(!libraryReady)return;
    setSaveState("Saving…");
    const updated:StoredWorkflow={id:workflowId,document:workflowDocument,updatedAt:new Date().toISOString()};
    setWorkflowLibrary(all=>{const index=all.findIndex(item=>item.id===workflowId); if(index<0)return [...all,updated]; const next=[...all];next[index]=updated;return next;});
    try{localStorage.setItem("flowforge.workflow.v1",JSON.stringify(workflowDocument));}catch{}
  },[workflowDocument,workflowId,libraryReady]);
  useEffect(()=>{if(libraryReady){try{localStorage.setItem("flowforge.workflows.v1",JSON.stringify(workflowLibrary));setSaveState("Saved locally")}catch{setSaveState("Local save failed")}}},[workflowLibrary,libraryReady]);
  useEffect(()=>{if(tab!=="outputs"||!workflowId)return;let active=true;window.flowforge.listOutputs(workflowId).then(items=>{if(active)setOutputArchives(items)}).catch(()=>{if(active)setOutputArchives([])});return()=>{active=false}},[tab,workflowId,outputRefreshToken]);
  useEffect(()=>{setOutputPreview(null)},[workflowId]);
  useEffect(()=>{
    const off=window.flowforge.onLog(line=>{ try{
      const p=JSON.parse(line);
      const safeLine = p.type === "session-export" ? JSON.stringify({type:p.type,data:{origin:p.data?.origin,cookies:p.data?.cookies?.length||0,localStorage:p.data?.localStorage?.length||0,sessionStorage:p.data?.sessionStorage?.length||0}})
        : p.type === "performance" ? `Performance: total ${p.data.totalDurationMs} ms; navigation ${p.data.navigationDurationMs ?? "n/a"} ms; DOM ready ${p.data.domContentLoadedMs ?? "n/a"} ms; load ${p.data.loadEventMs ?? "n/a"} ms; ${p.data.resourceCount ?? "n/a"} resources; ${p.data.transferBytes ?? "n/a"} transfer bytes.`
        : p.type === "step" && p.data.durationMs !== undefined ? `${p.data.status}: step ${p.data.index+1} (${p.data.name}) in ${p.data.durationMs} ms${p.data.attempts>1?` after ${p.data.attempts} attempts`:""}.`
        : line.trim();
      if(p.type === "user-input-request" && p.data && typeof p.data.requestId === "string" && Array.isArray(p.data.fields)) {
        setUserInputPrompt({ requestId:p.data.requestId, stepName:String(p.data.stepName||"User input"), fields:p.data.fields, values:Object.fromEntries(p.data.fields.map((field:{id:string})=>[field.id,""])) });
        setLogs(old=>[...old,`Waiting for user input: ${String(p.data.stepName||"User input")}.`].slice(-300));
      } else {
        setLogs(old=>[...old, safeLine].slice(-300));
      }
      if(p.type === "session-export" && p.data) {
        const json=JSON.stringify(p.data,null,2); const blob=new Blob([json],{type:"application/json"}); const a=document.createElement("a"); const url=URL.createObjectURL(blob); a.href=url; a.download=`flowforge-session-${new Date().toISOString().replace(/[:.]/g,"-")}.json`; a.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        setLogs(old=>[...old,`Session snapshot exported for ${p.data.origin}. Treat the file as a password-equivalent secret.`].slice(-300));
      }
      if(p.type === "output-archive") { setOutputRefreshToken(value=>value+1); setLogs(old=>[...old,`Output ZIP created: ${p.data?.name||"workflow output"}`].slice(-300)); }
      if(p.type === "session-import") setLogs(old=>[...old,`Session import finished: ${p.data.cookies} cookies added, ${p.data.expired} expired skipped, ${p.data.rejected} rejected, ${p.data.storageEntries} storage entries restored.`].slice(-300));
      if(p.type==="step") {
        setRunState(s=>({...s,[steps[p.data.index]?.id]:p.data.status}));
        const runId=activeRunId.current;
        if(runId) setRunHistory(items=>items.map(item=>item.id!==runId?item:{...item,successfulSteps:item.successfulSteps+(p.data.status==="success"?1:0),failedSteps:item.failedSteps+(p.data.status==="error"?1:0),skippedSteps:item.skippedSteps+(p.data.status==="skipped"?1:0),error:p.data.status==="error"?String(p.data.error||"Step failed"):item.error}));
      }
      if(p.type==="step-retry") setLogs(old=>[...old,`Retrying step ${p.data.index+1} (${p.data.nextAttempt}/${p.data.maxAttempts}): ${p.data.error}`].slice(-300));
      if(p.type==="done" && activeRunId.current) {
        const id=activeRunId.current; const endedAt=new Date().toISOString();
        setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:(p.data.stopped?"stopped":p.data.success&&item.failedSteps===0?"success":"failed") as RunRecord["status"],durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));
        activeRunId.current=null;
      }
      if(p.type==="error") setUserInputPrompt(null);
      if(p.type==="error" && activeRunId.current) {
        const id=activeRunId.current; const endedAt=new Date().toISOString();
        setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:"failed" as RunRecord["status"],error:String(p.data?.message||"Engine error"),durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));
        activeRunId.current=null;
      }
      if(p.type==="recorder" && p.data?.status==="selected" && p.data.selection) {
        const message=parseRecorderMessage({channel:"FLOWFORGE_RECORDER_V1",type:"selected",data:p.data.selection});
        if(message?.type==="selected") {
          const selectedElement=message.data as RecorderSelection;
          const step=makeStep(recorderAction);
          const locator=selectionToLocator(selectedElement,"css");
          step.name=`${({click:"Click",hover:"Hover over",waitVisible:"Wait for",extractText:"Extract text from",assertExists:"Assert exists:"} as Record<string,string>)[recorderAction]} ${selectedElement.id?`#${selectedElement.id}`:selectedElement.name?`[name=${selectedElement.name}]`:selectedElement.tagName}${selectedElement.text?`: ${selectedElement.text.slice(0,42)}`:""}`;
          step.target=locator;
          setSteps(all=>[...all,step]);setSelected(step.id);setTab("workflow");
          setLogs(old=>[...old,`Recorder captured ${selectedElement.tagName}${selectedElement.id?`#${selectedElement.id}`:""} using CSS: ${locator.value}. ${selectedElement.text?`Text: “${selectedElement.text.slice(0,60)}”.`:""}`].slice(-300));
        }
      }
      if(p.type==="recorder" && p.data?.status==="stopped")setRecording(false);
    }catch{}});
    const done=window.flowforge.onFinished(r=>{setRunning(false);setUserInputPrompt(null);setLogs(old=>[...old,`Engine exited (${r.code}).`]);if(activeRunId.current){const id=activeRunId.current;const endedAt=new Date().toISOString();setRunHistory(items=>items.map(item=>item.id!==id?item:{...item,endedAt,status:(r.stopped?"stopped":r.code===0?"success":"interrupted") as RunRecord["status"],error:r.code===0?item.error:`Runner exited with code ${r.code}`,durationMs:Math.max(0,Date.parse(endedAt)-Date.parse(item.startedAt))}));activeRunId.current=null;}});
    return ()=>{off();done()};
  },[steps,recorderAction]);
  useEffect(()=>{try{localStorage.setItem("flowforge.runHistory.v1",JSON.stringify(runHistory.slice(0,50)))}catch{}},[runHistory]);
  const update=(patch:Partial<Step>)=>setSteps(all=>all.map(s=>s.id===selected?{...s,...patch}:s));
  type NestedField = "thenSteps" | "elseSteps" | "loopSteps";
  const updateNested=(field:NestedField,next:WorkflowStep[])=>update({[field]:next} as Partial<Step>);
  const addNested=(field:NestedField,type:StepType="click")=>{if(!current)return;const child=makeStep(type);updateNested(field,[...((current[field]||[]) as WorkflowStep[]),child]);};
  const patchNested=(field:NestedField,id:string,patch:Partial<WorkflowStep>)=>{if(!current)return;updateNested(field,((current[field]||[]) as WorkflowStep[]).map(step=>step.id===id?({...step,...patch}):step));};
  const removeNested=(field:NestedField,id:string)=>{if(!current)return;updateNested(field,((current[field]||[]) as WorkflowStep[]).filter(step=>step.id!==id));};
  const renderNestedSteps=(field:NestedField,label:string)=>{
    const nested=((current?.[field]||[]) as WorkflowStep[]);
    return <section className="nested-builder"><div className="nested-builder-head"><div><strong>{label}</strong><span>{nested.length} {nested.length===1?"step":"steps"}</span></div><select aria-label={`Add step to ${label}`} className="nested-add-select" defaultValue="click" onChange={e=>{addNested(field,e.target.value as StepType);e.target.value="click"}}>{stepTypes.map(([value,text])=><option key={value} value={value}>{({navigate:"🌐",click:"🖱️",type:"⌨️",wait:"⏱️",assertText:"🔎",extractText:"📝",saveSession:"🍪",setVariable:"📦",regexReplace:"🧹",ifElse:"🔀",repeat:"🔁",userInput:"💬",runWorkflow:"🧰"} as Record<string,string>)[value]||"🔹"} {text}</option>)}</select><button className="secondary-button nested-add-button" onClick={()=>addNested(field,"click")}><Plus size={13}/> {t("Add")}</button></div>
      {nested.length===0?<div className="nested-empty"><Braces size={17}/><span>{t("No actions in this branch yet.")}</span><small>{t("Add an action to define what happens here.")}</small></div>:<div className="nested-step-list">{nested.map((child,index)=><div className="nested-step-card" key={child.id}><div className="nested-step-number">{index+1}</div><div className="nested-step-fields"><select className="text-input" aria-label="Nested action type" value={child.type} onChange={e=>{const type=e.target.value as StepType;const fresh=makeStep(type);patchNested(field,child.id,{...fresh,id:child.id,name:stepTypes.find(item=>item[0]===type)?.[1]||type})}}>{stepTypes.map(([value,text])=><option key={value} value={value}>{({navigate:"🌐",click:"🖱️",type:"⌨️",wait:"⏱️",assertText:"🔎",extractText:"📝",saveSession:"🍪",setVariable:"📦",regexReplace:"🧹",ifElse:"🔀",repeat:"🔁",userInput:"💬",runWorkflow:"🧰"} as Record<string,string>)[value]||"🔹"} {text}</option>)}</select><input className="text-input" aria-label="Nested step name" value={child.name} onChange={e=>patchNested(field,child.id,{name:e.target.value})} placeholder="Action name"/>
      {(child.type==="navigate"||child.type==="openTab")&&<input className="text-input" aria-label="Nested URL" value={child.url||""} onChange={e=>patchNested(field,child.id,{url:e.target.value})} placeholder="https://example.com"/>}
      {["click","type","key","hover","rightClick","doubleClick","dragDrop","scrollTo","waitVisible","waitClickable","assertText","select","uploadFile","extractText","extractAttribute","extractValue","extractTable","saveImage","assertExists","assertCount","assertAttribute","switchFrame"].includes(child.type)&&child.target&&<div className="nested-locator-row"><select className="locator-select" aria-label="Nested locator strategy" value={child.target.strategy} onChange={e=>patchNested(field,child.id,{target:{...child.target!,strategy:e.target.value as LocatorStrategy}})}>{["css","xpath","id","name","linkText","className","tagName"].map(value=><option key={value}>{value}</option>)}</select><input className="text-input locator-value" aria-label="Nested locator" value={child.target.value} onChange={e=>patchNested(field,child.id,{target:{...child.target!,value:e.target.value}})} placeholder="CSS selector or XPath"/></div>}
      {(["type","key","saveText","select"].includes(child.type))&&<input className="text-input" aria-label="Nested text value" value={child.text||""} onChange={e=>patchNested(field,child.id,{text:e.target.value})} placeholder={child.type==="saveText"?"Text to save":"Text or value"}/>}
      </div><button className="tiny-icon always-visible" title="Remove nested step" onClick={()=>removeNested(field,child.id)}><Trash2 size={13}/></button></div>)}</div>}</section>;
  };
  const submitUserInput=async()=>{
    if(!userInputPrompt)return;
    const missing=userInputPrompt.fields.find(field=>field.required&&!String(userInputPrompt.values[field.id]||"").trim());
    if(missing){setUserInputPrompt(prompt=>prompt?{...prompt,error:`${missing.title} is required.`}:prompt);return;}
    const invalid=userInputPrompt.fields.find(field=>{const value=String(userInputPrompt.values[field.id]||"");if(!value && !field.required)return false;if(field.valueType==="number"&&!Number.isFinite(Number(value)))return true;if(field.valueType==="boolean"&&! ["true","false"].includes(value.trim().toLowerCase()))return true;if(field.pattern){try{return !new RegExp(field.pattern).test(value)}catch{return true}}return false});
    if(invalid){setUserInputPrompt(prompt=>prompt?{...prompt,error:`${invalid.title} has an invalid value. Check its type or regex pattern.`}:prompt);return;}
    const result=await window.flowforge.respondUserInput({requestId:userInputPrompt.requestId,values:userInputPrompt.values});
    if(!result.ok){setUserInputPrompt(prompt=>prompt?{...prompt,error:result.error||"Could not send input."}:prompt);return;}
    setUserInputPrompt(null);
  };
  const cancelUserInput=async()=>{if(!userInputPrompt)return;await window.flowforge.respondUserInput({requestId:userInputPrompt.requestId,cancel:true});setUserInputPrompt(null)};
  const addStep=(type:StepType="click")=>{const s=makeStep(type);setSteps(all=>[...all,s]);setSelected(s.id);setTab("workflow")};
  const duplicateStep=()=>{if(!current)return;const clone={...current,id:createId(),name:`${current.name} copy`,target:{...current.target}};const i=steps.findIndex(s=>s.id===current.id);const next=[...steps];next.splice(i+1,0,clone);setSteps(next);setSelected(clone.id)};
  const addGroup=()=>{const group={id:createId(),name:`Group ${groups.length+1}`,collapsed:false};setGroups(all=>[...all,group]);setLogs(old=>[...old,`Created ${group.name}.`])};
  const addVariable=()=>setVariables(all=>[...all,{id:createId(),name:`variable${all.length+1}`,value:"",secret:false}]);
  const deleteStep=(id:string)=>{const next=steps.filter(x=>x.id!==id);setSteps(next);if(selected===id)setSelected(next[0]?.id||"")};
  const move=(direction:number)=>{const i=steps.findIndex(s=>s.id===selected),j=i+direction;if(j<0||j>=steps.length)return;const copy=[...steps];[copy[i],copy[j]]=[copy[j],copy[i]];setSteps(copy)};
  const run=async()=>{if(running){setLogs(old=>[...old,"Scheduled run skipped because a workflow is already running."]);return}if(steps.length===0){setLogs(["Add at least one step before running the workflow."]);return}if(!validation.valid){setLogs(["Workflow validation failed:",...validation.errors]);return}setLogs([]);setRunState({});setRunning(true);const startedAt=new Date().toISOString();const record:RunRecord={id:createId(),workflow:workflowName,startedAt,status:"running",totalSteps:steps.length,successfulSteps:0,failedSteps:0,skippedSteps:0};activeRunId.current=record.id;setRunHistory(items=>[record,...items].slice(0,50));const result=await window.flowforge.start({steps,startUrl,browser,variables,workflowName,currentWorkflowId:workflowId,profile:{name:profileName,browser,userDataDir:userDataDir||undefined},optimizations:{disableImages,disableCss,disableFonts,disableMedia,pageLoadStrategy,headless},closeBrowserWhenDone:closeBrowser,workflowLibrary:Object.fromEntries(workflowLibrary.map(item=>[item.id,item.id===workflowId?workflowDocument:item.document]))});if(!result.ok){setRunning(false);activeRunId.current=null;const endedAt=new Date().toISOString();setRunHistory(items=>items.map(item=>item.id!==record.id?item:{...item,endedAt,status:"failed" as RunRecord["status"],error:result.error||"Could not start engine.",durationMs:Date.parse(endedAt)-Date.parse(startedAt)}));setLogs([result.error||"Could not start engine."]) }};
  const scheduledRunRef=useRef<()=>Promise<void>>(async()=>{});
  scheduledRunRef.current=run;
  useEffect(()=>{try{localStorage.setItem("flowforge.schedule.enabled.v1",String(scheduleEnabled));localStorage.setItem("flowforge.schedule.every.v1",String(scheduleEvery));localStorage.setItem("flowforge.schedule.unit.v1",scheduleUnit);localStorage.setItem("flowforge.schedule.startup.v1",String(scheduleStartup))}catch{}},[scheduleEnabled,scheduleEvery,scheduleUnit,scheduleStartup]);
  useEffect(()=>{if(!scheduleEnabled)return;const factor=scheduleUnit==="seconds"?1000:scheduleUnit==="hours"?3600000: scheduleUnit==="days"?86400000:60000;const ms=Math.min(2147483647,Math.max(1000,scheduleEvery*factor));const timer=window.setInterval(()=>{void scheduledRunRef.current()},ms);return()=>window.clearInterval(timer)},[scheduleEnabled,scheduleEvery,scheduleUnit]);
  useEffect(()=>{if(!scheduleStartup||!libraryReady)return;const marker=`flowforge.startup-ran.${workflowId}`;try{if(sessionStorage.getItem(marker)==="true")return;sessionStorage.setItem(marker,"true")}catch{}const timer=window.setTimeout(()=>{void scheduledRunRef.current()},1200);return()=>window.clearTimeout(timer)},[scheduleStartup,libraryReady]);
  const startRecorder=async()=>{const result=await window.flowforge.recorderStart({startUrl:recordUrl,browser,profile:{name:profileName,browser,userDataDir:userDataDir||undefined}});if(result.ok){setRecording(true);setRunning(true);setLogs(old=>[...old,"Recorder browser started. Hover over a page element and click to capture its locator."])}else setLogs(old=>[...old,result.error||"Could not start recorder."])};
  const stopRecorder=async()=>{const result=await window.flowforge.recorderStop();if(!result.ok)setLogs(old=>[...old,result.error||"Could not stop recorder."]);};
  const saveProfile=async()=>{const r=await window.flowforge.saveProfile({name:profileName,browser,userDataDir,optimizations:{disableImages,disableCss,disableFonts,disableMedia,pageLoadStrategy,headless}});setLogs(old=>[...old,`Profile saved: ${r.path||profileName}`])};
  const exportSession=async()=>{const r=await window.flowforge.sessionExport();if(!r.ok)setLogs(old=>[...old,r.error||"Could not export session."]);else setLogs(old=>[...old,"Session export requested. The browser must be running on the origin you want to capture."])};
  const importSession=()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error("Session file exceeds the 2 MB limit.");const snapshot=validateSessionSnapshot(JSON.parse(await f.text()));const r=await window.flowforge.sessionImport(snapshot);if(!r.ok)throw new Error(r.error||"No browser session is running.");setLogs(old=>[...old,`Validated session snapshot for ${snapshot.origin}; import queued.`]);}catch(e){setLogs(old=>[...old,`Session import rejected: ${e instanceof Error?e.message:String(e)}`])}};input.click()};
  const downloadJson=(value:unknown,filename:string)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"});const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download=filename;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const getWorkflowPackage=()=>buildWorkflowPackage(workflowId,workflowLibrary,{id:workflowId,document:workflowDocument});
  const getWorkflowPackageFor=(rootId:string)=>buildWorkflowPackage(rootId,workflowLibrary,{id:workflowId,document:workflowDocument});
  const exportWorkflow=()=>{try{downloadJson(getWorkflowPackage(),`${workflowName.trim().replace(/[^a-z0-9-_]+/gi,"-")||"workflow"}.flowforge.json`);setLogs(old=>[...old,"Workflow package exported, including referenced sub-workflows."])}catch(e){setLogs(old=>[...old,`Export failed: ${e instanceof Error?e.message:String(e)}`])}};
  const exportWorkflowFor=(item:StoredWorkflow)=>{try{downloadJson(getWorkflowPackageFor(item.id),`${item.document.name.replace(/[^a-z0-9-_]+/gi,"-")||"workflow"}.flowforge.json`);setLogs(old=>[...old,`Exported ${item.document.name} with its referenced sub-workflows.`])}catch(e){setLogs(old=>[...old,`Export failed: ${e instanceof Error?e.message:String(e)}`])}};
  const activateWorkflow=(item:StoredWorkflow)=>{setWorkflowLibrary(all=>all.map(existing=>existing.id===workflowId?{...existing,document:workflowDocument,updatedAt:new Date().toISOString()}:existing));setWorkflowId(item.id);setWorkflowName(item.document.name);setSteps(item.document.steps as unknown as Step[]);setStartUrl(item.document.startUrl);setBrowser(item.document.browser);setGroups(item.document.groups);setVariables(item.document.variables);setSelected(item.document.steps[0]?.id||"");setTab("workflow");setSaveState("Saved locally")};
  const newWorkflow=()=>{const doc:WorkflowDocument={...createEmptyWorkflow(),name:`Workflow ${workflowLibrary.length+1}`,steps:[{...makeStep("navigate"),name:"Open website",url:"https://example.com"}] as unknown as WorkflowDocument["steps"]};const item={id:createId(),document:doc,updatedAt:new Date().toISOString()};setWorkflowLibrary(all=>[...all,item]);activateWorkflow(item);setCommandOpen(false);setCommandQuery("")};
  const duplicateWorkflow=(item:StoredWorkflow)=>{const doc=normalizeWorkflow({...item.document,name:`${item.document.name} copy`,steps:item.document.steps.map(step=>({...step,id:createId()}))});const clone={id:createId(),document:doc,updatedAt:new Date().toISOString()};setWorkflowLibrary(all=>[...all,clone]);activateWorkflow(clone);setLogs(old=>[...old,`Duplicated workflow: ${doc.name}`])};
  const deleteWorkflow=(id:string)=>{if(workflowLibrary.length<=1){setLogs(old=>[...old,"Keep at least one workflow in your library."]);return}const dependents=workflowLibrary.filter(item=>item.id!==id&&item.document.steps.some(step=>step.type==="runWorkflow"&&step.workflowId===id));if(dependents.length){setLogs(old=>[...old,`Cannot delete this workflow because it is used by: ${dependents.map(item=>item.document.name).join(", ")}. Remove those workflow actions first.`]);return}const next=workflowLibrary.filter(item=>item.id!==id);setWorkflowLibrary(next);if(workflowId===id)activateWorkflow(next[0]);setLogs(old=>[...old,"Workflow removed from the local library."])};
  const importWorkflow=()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{if(f.size>5_000_000)throw new Error("Workflow JSON exceeds the 5 MB import limit.");const parsed=JSON.parse(await f.text());const imported=importWorkflowPackage(parsed);setWorkflowLibrary(all=>[...all,...imported.workflows]);const root=imported.workflows.find(item=>item.id===imported.rootWorkflowId)||imported.workflows[0];activateWorkflow(root);setLogs(old=>[...old,`Imported ${imported.workflows.length} workflow${imported.workflows.length===1?"":"s"} from ${f.name}.`]);}catch(e){setLogs(old=>[...old,`Import rejected: ${e instanceof Error?e.message:String(e)}`])}};input.click()};
  const applyTemplate=(kind:"starter"|"form"|"search")=>{
    const id=()=>createId();
    const templates:Record<typeof kind,{name:string;url:string;steps:Step[]}>= {
      starter:{name:"Website smoke check",url:"https://example.com",steps:[
        {...makeStep("navigate"),id:id(),name:"Open website",url:"https://example.com"},
        {...makeStep("waitVisible"),id:id(),name:"Wait for page heading",target:{strategy:"css",value:"h1"},timeout:10000},
        {...makeStep("assertText"),id:id(),name:"Verify heading text",target:{strategy:"css",value:"h1"},expected:"Example Domain",timeout:10000}
      ]},
      form:{name:"Form entry starter",url:"https://example.com",steps:[
        {...makeStep("navigate"),id:id(),name:"Open form page",url:"https://example.com"},
        {...makeStep("waitVisible"),id:id(),name:"Wait for form field",target:{strategy:"css",value:"input[name=\"email\"]"},timeout:10000},
        {...makeStep("type"),id:id(),name:"Enter email",target:{strategy:"css",value:"input[name=\"email\"]"},text:"name@example.com",clearFirst:true},
        {...makeStep("click"),id:id(),name:"Submit form",target:{strategy:"css",value:"button[type=\"submit\"]"},timeout:10000}
      ]},
      search:{name:"Search page starter",url:"https://example.com",steps:[
        {...makeStep("navigate"),id:id(),name:"Open search page",url:"https://example.com"},
        {...makeStep("waitVisible"),id:id(),name:"Wait for search input",target:{strategy:"css",value:"input[type=\"search\"]"},timeout:10000},
        {...makeStep("type"),id:id(),name:"Enter search query",target:{strategy:"css",value:"input[type=\"search\"]"},text:"replace with your query",clearFirst:true},
        {...makeStep("key"),id:id(),name:"Submit search",target:{strategy:"css",value:"input[type=\"search\"]"},key:"ENTER",timeout:10000}
      ]}
    };
    const template=templates[kind];setWorkflowName(template.name);setStartUrl(template.url);setSteps(template.steps);setSelected(template.steps[0]?.id||"");setGroups([]);setVariables([]);setTab("workflow");setCommandOpen(false);setCommandQuery("");setLogs(old=>[...old,`Loaded template: ${template.name}. Replace example selectors and URLs before running.`].slice(-300));
  };
  const commandItems:{label:string;detail:string;run:()=>void}[]=[
    {label:"Run workflow",detail:"Execute the current workflow",run:()=>{setCommandOpen(false);void run()}},
    {label:"Stop workflow",detail:"Request the running browser to stop",run:()=>{setCommandOpen(false);void window.flowforge.stop()}},
    {label:"New workflow",detail:"Start with one navigation step",run:newWorkflow},
    {label:"Add click step",detail:"Insert a click action",run:()=>{addStep("click");setCommandOpen(false)}},
    {label:"Add type step",detail:"Insert a type-text action",run:()=>{addStep("type");setCommandOpen(false)}},
    {label:"Add user input step",detail:"Prompt the user and fill mapped webpage elements",run:()=>{addStep("userInput");setCommandOpen(false)}},
    {label:"Import workflow",detail:"Open a FlowForge JSON file",run:()=>{setCommandOpen(false);importWorkflow()}},
    {label:"Export workflow",detail:"Save the current workflow as JSON",run:()=>{setCommandOpen(false);exportWorkflow()}},
    {label:"Open workflow library",detail:"Manage, duplicate, import and share workflows",run:()=>{setTab("library");setCommandOpen(false);setCommandQuery("")}},
    {label:"Open workflow outputs",detail:"Preview, open, or delete this workflow's output ZIP archives",run:()=>{setTab("outputs");setCommandOpen(false);setCommandQuery("")}},
    {label:"Open templates",detail:"Browse reusable workflow starters",run:()=>{setTab("templates");setCommandOpen(false);setCommandQuery("")}},
    {label:"Open browser",detail:"Browser and selector information",run:()=>{setTab("browser");setCommandOpen(false)}},
    {label:"Open profiles",detail:"Browser profile and session tools",run:()=>{setTab("profiles");setCommandOpen(false)}},
    {label:"Open settings",detail:"Performance and browser settings",run:()=>{setTab("settings");setCommandOpen(false)}},
    {label:"Open run history",detail:"Review recent execution outcomes",run:()=>{setTab("history");setCommandOpen(false)}},
    {label:"Open logs",detail:"View engine diagnostics",run:()=>{setTab("logs");setCommandOpen(false)}}
  ];
  const filteredCommands=commandItems.filter(item=>`${t(item.label)} ${t(item.detail)}`.toLowerCase().includes(commandQuery.toLowerCase()));
  useEffect(()=>{const onKeyDown=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setCommandOpen(open=>!open);setCommandQuery("");}else if(event.key==="Escape"){setCommandOpen(false);}};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown)},[]);
  useEffect(()=>{if(commandOpen)commandInputRef.current?.focus()},[commandOpen]);
  const checkForUpdates=async(showStatus=false)=>{
    setUpdateChecking(true); if(showStatus)setUpdateMessage("");
    try {
      const result=await window.flowforge.checkForUpdates();
      if(result.available){setUpdateInfo(result);setUpdateMessage("");}
      else {setUpdateInfo(null);if(showStatus)setUpdateMessage(result.ok?t("You are up to date."):t("Could not check for updates.")+(result.error?` ${result.error}`:""));}
    } catch { if(showStatus)setUpdateMessage(t("Could not check for updates.")); }
    finally {setUpdateChecking(false);}
  };
  useEffect(()=>{const timer=window.setTimeout(()=>{void checkForUpdates(false)},1400);return()=>window.clearTimeout(timer)},[]);
  const title=useMemo(()=>current?.name||"No step selected",[current]);
  return <div className="app-shell" data-theme={theme} data-language={language} dir={language === "fa" ? "rtl" : "ltr"} lang={language}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Zap size={17}/></div><span>flowforge</span><span className="version">{t("Desktop")}</span></div>
      <div className="top-center"><span className="live-dot"/><span>{t("LOCAL AUTOMATION ENGINE")}</span><span className="top-sep">/</span><span className="muted">{workflowName} · {saveState}</span></div>
      <div className="top-actions"><button className="language-toggle secondary-button" onClick={()=>setLanguage(value=>value === "en" ? "fa" : "en")} title={t("Choose language")} aria-label={t("Choose language")}><span>{language === "en" ? "FA" : "EN"}</span><small>{language === "en" ? "فارسی" : "English"}</small></button><button className="theme-toggle icon-button" title={t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme")} aria-label={t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme")} onClick={()=>setTheme(value=>value === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="command-trigger" onClick={()=>{setCommandOpen(true);setCommandQuery("")}} aria-label={t("Open command palette")}><Search size={14}/><span>{t("Commands")}</span><kbd>Ctrl K</kbd></button><input aria-label={t("URL")} className="recorder-url" value={recordUrl} onChange={e=>setRecordUrl(e.target.value)} placeholder="https://example.com" /><button className="icon-button" title={t("Import workflow")} onClick={importWorkflow}><FolderOpen size={16}/></button><button className="icon-button" title={t("Export workflow")} onClick={exportWorkflow}><Save size={16}/></button><select className="recorder-action-select" aria-label="Action to record" title={t("Choose the action to create when you select an element")} value={recorderAction} onChange={e=>setRecorderAction(e.target.value as typeof recorderAction)}><option value="click">{t("Record click")}</option><option value="hover">{t("Record hover")}</option><option value="waitVisible">{t("Record wait")}</option><option value="extractText">{t("Record text extraction")}</option><option value="assertExists">{t("Record existence check")}</option></select><button className="icon-button" title={t("Start visual recorder")} onClick={startRecorder} disabled={running}><MousePointer2 size={15}/>{recording?t("Recording"):t("Record")}</button>{recording&&<button className="icon-button" title={t("Stop recorder")} onClick={stopRecorder}><Square size={14}/></button>}<button className="run-button" onClick={run} disabled={running||!validation.valid||steps.length===0}><Play size={14} fill="currentColor"/>{running?t("Running"):t("Run workflow")}</button><button className="stop-button" onClick={()=>window.flowforge.stop()} disabled={!running}><Square size={13} fill="currentColor"/></button></div>
    </header>
    <div className="workspace">
      <aside className="rail">
        <button className={tab==="workflow"?"rail-item active":"rail-item"} onClick={()=>setTab("workflow")}><Layers3 size={18}/><span>{t("Editor")}</span></button>
        <button className={tab==="library"?"rail-item active":"rail-item"} onClick={()=>setTab("library")}><BookTemplate size={18}/><span>{t("Workflows")}</span></button>
        <button className={tab==="outputs"?"rail-item active":"rail-item"} onClick={()=>setTab("outputs")}><Archive size={18}/><span>{t("Outputs")}</span></button>
        <button className={tab==="browser"?"rail-item active":"rail-item"} onClick={()=>setTab("browser")}><Globe2 size={18}/><span>{t("Browser")}</span></button>
        <button className={tab==="templates"?"rail-item active":"rail-item"} onClick={()=>setTab("templates")}><BookTemplate size={18}/><span>{t("Templates")}</span></button>
        <button className={tab==="profiles"?"rail-item active":"rail-item"} onClick={()=>setTab("profiles")}><Cookie size={18}/><span>{t("Profiles")}</span></button>
        <button className={tab==="settings"?"rail-item active":"rail-item"} onClick={()=>setTab("settings")}><Settings2 size={18}/><span>{t("Settings")}</span></button>
        <button className={tab==="history"?"rail-item active":"rail-item"} onClick={()=>setTab("history")}><Clock3 size={18}/><span>{t("Run history")}</span></button>
        <div className="rail-bottom"><button className="rail-item" onClick={()=>setTab("logs")}><Terminal size={18}/><span>{t("Logs")}</span></button><div className="engine-badge"><span className="live-dot"/>{t("ENGINE ONLINE")}</div></div>
      </aside>
      {tab==="workflow" && <>
        <section className={`steps-panel ${stepsCollapsed?"panel-collapsed":""}`} style={{width:stepsCollapsed?44:stepsWidth, minWidth:stepsCollapsed?44:230}}>
          <div className="panel-heading"><div>{!stepsCollapsed&&<><div className="eyebrow">{t("AUTOMATION BUILDER")}</div><h1>{t("Workflow")}</h1><p>{t("Build repeatable browser tasks, one step at a time.")}</p></>}</div><div className="panel-heading-actions"><button className="square-button panel-collapse-button" onClick={()=>setStepsCollapsed(v=>!v)} title={stepsCollapsed?t("Expand workflow steps"):t("Collapse workflow steps")} aria-label={stepsCollapsed?t("Expand workflow steps"):t("Collapse workflow steps")}><ChevronDown size={15}/></button>{!stepsCollapsed&&<button className="square-button" onClick={()=>addStep()} title="Add step"><Plus size={17}/></button>}</div></div>
          {!stepsCollapsed&&<>
          <div className="flow-meta"><span><Braces size={13}/> {steps.length} STEPS</span><span><Clock3 size={13}/> {t("SEQUENTIAL")}</span><button className="text-action" onClick={addGroup}><Plus size={12}/> {t("Group")}</button></div>
          <div className="workflow-name-wrap"><label className="field-label">{t("Workflow name")}</label><input className="text-input" value={workflowName} onChange={e=>setWorkflowName(e.target.value)} aria-label="Workflow name"/></div>
          {groups.length>0&&<div className="group-list">{groups.map(g=><div className="group-row" key={g.id}><input className="text-input" value={g.name} aria-label="Group name" onChange={e=>setGroups(all=>all.map(x=>x.id===g.id?{...x,name:e.target.value}:x))}/><button className="tiny-icon always-visible" title="Delete group and ungroup its steps" onClick={()=>{setGroups(all=>all.filter(x=>x.id!==g.id));setSteps(all=>all.map(s=>s.groupId===g.id?({...s,groupId:undefined}):s))}}><Trash2 size={13}/></button></div>)}</div>}
          <div className="step-search-wrap"><Search size={14}/><input aria-label="Search workflow steps" value={stepSearch} onChange={e=>setStepSearch(e.target.value)} placeholder="Find a step…"/><kbd>{steps.length}</kbd></div>
          <div className="step-list">
            {steps.filter(s=>`${s.name} ${s.type} ${s.target?.value||""}`.toLowerCase().includes(stepSearch.toLowerCase())).map((s,i)=><div key={s.id} className={`step-card ${s.id===selected?"selected":""}`} onClick={()=>setSelected(s.id)}>
              <div className="step-index">{runState[s.id]==="success"?<Check size={14}/>:runState[s.id]==="running"?<span className="spinner"/>:<span>{String(i+1).padStart(2,"0")}</span>}</div>
              <div className="step-info"><div className="step-name">{s.name}</div><div className="step-sub">{s.type}{s.target?.value?` · ${s.target.strategy}`:""}{s.groupId?` · ${groups.find(g=>g.id===s.groupId)?.name||"Group"}`:""}</div></div>
              <button className="tiny-icon" onClick={e=>{e.stopPropagation();deleteStep(s.id)}} title="Delete step"><Trash2 size={14}/></button>
            </div>)}
          </div>
          <button className="add-step" onClick={()=>addStep()}><Plus size={15}/> {t("Add step")}</button>
          <button className="add-step add-user-input-step" onClick={()=>addStep("userInput")}><Braces size={15}/> {t("Add user input step")}</button>
          <div className="panel-footer"><ShieldCheck size={14}/><span>{t("Runs locally on your machine")}</span></div>
          </>}
        </section>
        <div className="panel-resizer" role="separator" aria-orientation="vertical" aria-label={t("Resize workflow steps panel")} onMouseDown={event=>beginResize("steps",event,stepsWidth)} />
        <main className="editor-panel">
          <div className="editor-top"><div><div className="eyebrow">{t("STEP CONFIGURATION")}</div><h2>{title}</h2></div><div className="editor-tools"><button className="icon-button" onClick={()=>move(-1)} title="Move up"><ArrowUp size={15}/></button><button className="icon-button" onClick={()=>move(1)} title="Move down"><ArrowDown size={15}/></button><button className="icon-button" onClick={duplicateStep} title="Duplicate step"><Copy size={15}/></button></div></div>
          {current?<div className="editor-content">
            <label className="field-label">{t("Step name")}</label><input className="text-input" value={current.name} onChange={e=>update({name:e.target.value})}/>
            <label className="field-label">{t("Group")}</label><div className="select-wrap"><select className="text-input" value={current.groupId||""} onChange={e=>update({groupId:e.target.value||undefined})}><option value="">{t("Ungrouped")}</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><ChevronDown size={14}/></div>
            <label className="field-label">{t("Action type")}</label><div className="select-wrap"><select className="text-input" value={current.type} onChange={e=>{const type=e.target.value as StepType;const fresh=makeStep(type);update({...fresh,id:current.id,groupId:current.groupId,name:t(stepTypes.find(t=>t[0]===type)?.[1]||type)})}}>{([{label:"Navigation",types:["navigate","back","forward","refresh","openTab","closeTab","switchWindow"]},{label:"Interaction",types:["click","type","key","hover","rightClick","doubleClick","dragDrop","scrollTo","scroll","select","uploadFile","alertAccept","alertDismiss","switchFrame","switchFrameDefault"]},{label:"Waits & checks",types:["waitVisible","waitClickable","wait","waitDownload","assertText","assertUrl","assertExists","assertCount","assertTitle","assertAttribute"]},{label:"Extract & save",types:["extractText","extractAttribute","extractValue","extractTable","extractAll","saveText","saveImage","screenshot","saveSession"]},{label:"Logic & data",types:["ifElse","repeat","loopList","while","breakLoop","continueLoop","setVariable","regexReplace","operateAll","userInput","runWorkflow"]}] as {label:string;types:string[]}[]).map(group=><optgroup key={group.label} label={t(group.label)}>{stepTypes.filter(([v])=>group.types.includes(v)).map(([v,l])=><option value={v} key={v}>{({navigate:"🌐",back:"↩️",forward:"↪️",refresh:"🔄",openTab:"🗂️",closeTab:"✖️",switchWindow:"🪟",click:"🖱️",type:"⌨️",key:"⌨️",hover:"👆",rightClick:"🖱️",doubleClick:"🖱️",dragDrop:"↔️",scrollTo:"🎯",scroll:"📜",waitVisible:"👁️",waitClickable:"🟢",wait:"⏱️",waitDownload:"📥",assertText:"🔎",assertUrl:"🔗",assertExists:"✅",assertCount:"🔢",assertTitle:"🏷️",assertAttribute:"🧩",select:"📋",uploadFile:"📤",extractText:"📝",extractAttribute:"🧩",extractValue:"📥",extractTable:"📊",saveText:"💾",saveImage:"🖼️",screenshot:"📸",saveSession:"🍪",setVariable:"📦",regexReplace:"🧹",extractAll:"📚",operateAll:"⚙️",ifElse:"🔀",repeat:"🔁",loopList:"📃",while:"🔄",breakLoop:"⏹️",continueLoop:"⏭️",userInput:"💬",runWorkflow:"🧰",alertAccept:"✅",alertDismiss:"🚫",switchFrame:"🖼️",switchFrameDefault:"↩️"} as Record<string,string>)[v]||"🔹"} {t(l)}</option>)}</optgroup>)}</select><ChevronDown size={14}/></div>
            {["navigate","openTab"].includes(current.type)&&<><label className="field-label">{t("URL")}</label><input className="text-input" value={current.url||""} onChange={e=>update({url:e.target.value})} placeholder="https://example.com"/></>}
            {["click","type","waitVisible","waitClickable","assertText","select","hover","rightClick","doubleClick","dragDrop","scrollTo","uploadFile","extractText","extractAttribute","extractValue","extractTable","saveImage","assertExists","assertCount","assertAttribute","switchFrame","extractAll","operateAll"].includes(current.type)&&<>
              <div className="field-label-row"><label className="field-label">{t("Target locator")}</label><button className="text-action" onClick={()=>setTab("browser")}><MousePointer2 size={13}/> {t("Record selector")}</button></div>
              <div className="locator-row"><select className="locator-select" value={current.target?.strategy||"css"} onChange={e=>update({target:{...current.target,strategy:e.target.value as LocatorStrategy}})}>{["xpath","css","id","name","linkText","className","tagName"].map(x=><option key={x} value={x}>{t(x)}</option>)}</select><input className="text-input locator-value" value={current.target?.value||""} onChange={e=>update({target:{...current.target,value:e.target.value}})} placeholder="//button[@id='submit']"/></div>
              <div className="hint"><CircleHelp size={13}/> {t("XPath and CSS selectors are supported. Use Record selector to capture a page element.")}</div>
            </>}
            {current.type==="type"&&<><label className="field-label">{t("Text to type")}</label><textarea className="text-input textarea" value={current.text||""} onChange={e=>update({text:e.target.value})}/><label className="check-row"><input type="checkbox" checked={current.clearFirst!==false} onChange={e=>update({clearFirst:e.target.checked})}/> {t("Clear field before typing")}</label></>}
            {current.type==="key"&&<><label className="field-label">{t("Key / shortcut")}</label><input className="text-input" value={current.key||""} onChange={e=>update({key:e.target.value})} placeholder="ENTER or CONTROL + A"/><div className="hint">{t("Selenium key names are supported, e.g. ENTER, TAB, ESCAPE.")}</div></>}
            {current.type==="wait"&&<><label className="field-label">{t("Duration (milliseconds)")}</label><input className="text-input" type="number" min="0" max="300000" value={current.ms??1000} onChange={e=>update({ms:Math.max(0,Math.min(300000,Number(e.target.value)||0))})}/></>}
            {current.type==="userInput"&&<section className="user-input-config"><div className="section-caption">{t("POP-UP INPUT FIELDS")}</div><p className="hint">{t("When this step runs, FlowForge opens a dialog for the user. Each answer is typed into its mapped webpage element.")}</p>{(current.inputs||[]).map((field,index)=><div className="input-field-config" key={field.id}><div className="input-field-heading"><strong>Input {index+1}</strong><button className="tiny-icon always-visible" title="Remove input" disabled={(current.inputs||[]).length<=1} onClick={()=>update({inputs:(current.inputs||[]).filter(item=>item.id!==field.id)})}><Trash2 size={13}/></button></div><label className="field-label">{t("Input title")}</label><input className="text-input" value={field.title} placeholder="e.g. Account email" onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,title:e.target.value}:item)})}/><label className="field-label">{t("Placeholder text")}</label><input className="text-input" value={field.placeholder||""} placeholder="Shown inside the pop-up" onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,placeholder:e.target.value}:item)})}/><label className="field-label">{t("Input type")}</label><select className="text-input" value={field.valueType||"text"} onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,valueType:e.target.value as UserInputField["valueType"]}:item)})}><option value="text">Text</option><option value="number">Number</option><option value="boolean">True / false</option></select><label className="field-label">{t("Regex pattern (optional)")}</label><input className="text-input" value={field.pattern||""} onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,pattern:e.target.value||undefined}:item)})} placeholder="e.g. ^[A-Z]{2}\d{4}$"/><label className="field-label">{t("Destination element")}</label><div className="locator-row"><select className="locator-select" aria-label={`Input ${index+1} locator strategy`} value={field.target?.strategy||"css"} onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,target:{...item.target,strategy:e.target.value as UserInputField["target"]["strategy"]}}:item)})}>{["css","xpath","id","name","className","tagName"].map(strategy=><option key={strategy}>{strategy}</option>)}</select><input className="text-input locator-value" aria-label={`Input ${index+1} destination locator`} value={field.target?.value||""} placeholder="#email or //input[@name='email']" onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,target:{...item.target,value:e.target.value}}:item)})}/></div><div className="input-field-options"><label className="check-row"><input type="checkbox" checked={field.required!==false} onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,required:e.target.checked}:item)})}/> {t("Required")}</label><label className="check-row"><input type="checkbox" checked={field.secret===true} onChange={e=>update({inputs:(current.inputs||[]).map(item=>item.id===field.id?{...item,secret:e.target.checked}:item)})}/> {t("Hide value in pop-up")}</label></div></div>)}<button className="secondary-button" onClick={()=>update({inputs:[...(current.inputs||[]),{id:createId(),title:`Input ${(current.inputs||[]).length+1}`,placeholder:"Enter a value",required:true,secret:false,valueType:"text",target:{strategy:"css",value:""}}]})}><Plus size={13}/> {t("Add another input")}</button></section>}
            {current.type==="runWorkflow"&&<><label className="field-label">{t("Workflow to run")}</label><div className="select-wrap"><select className="text-input" value={current.workflowId||""} onChange={e=>update({workflowId:e.target.value})}><option value="">{t("Select a workflow…")}</option>{workflowLibrary.filter(item=>item.id!==workflowId).map(item=><option key={item.id} value={item.id}>{item.document.name}</option>)}</select><ChevronDown size={14}/></div><p className="hint">{t("Runs the selected workflow inside the current browser session. Sub-workflows can call other workflows, with cycle and depth protection.")}</p></>}
            {current.type==="assertText"&&<><label className="field-label">{t("Expected text includes")}</label><input className="text-input" value={current.expected||""} onChange={e=>update({expected:e.target.value})}/></>}
            {current.type==="select"&&<><label className="field-label">{t("Option value")}</label><input className="text-input" value={current.text||""} onChange={e=>update({text:e.target.value})}/></>}
            {["saveText"].includes(current.type)&&<><label className="field-label">{current.type==="select"?"Option value":"Text content"}</label><textarea className="text-input textarea" value={current.text||""} onChange={e=>update({text:e.target.value})} placeholder={current.type==="saveText"?"Text to save into the workflow output ZIP":"Text to enter"}/></>}
            {["extractText","extractAttribute","extractValue","extractTable","saveText","saveImage","screenshot","saveSession"].includes(current.type)&&<><label className="field-label">{t("Output name / variable")}</label><input className="text-input" value={current.outputName||""} onChange={e=>update({outputName:e.target.value})} placeholder="e.g. customer-name"/><div className="hint">{t("Extracted values become workflow variables and artifacts in this workflow's output ZIP.")}</div></>}
            {["extractAttribute","assertAttribute"].includes(current.type)&&<><label className="field-label">{t("Attribute name")}</label><input className="text-input" value={current.attribute||"href"} onChange={e=>update({attribute:e.target.value})} placeholder="href, src, aria-label"/></>}
            {["assertText","assertUrl","assertTitle","assertAttribute","assertCount","waitDownload"].includes(current.type)&&<><label className="field-label">{current.type==="waitDownload"?"Expected filename contains (optional)":"Expected value"}</label><input className="text-input" value={current.expected||""} onChange={e=>update({expected:e.target.value})} placeholder={current.type==="assertCount"?"0": "Expected text or value"}/></>}
            {current.type==="dragDrop"&&<><label className="field-label">{t("Destination locator strategy")}</label><select className="text-input" value={current.target2?.strategy||"css"} onChange={e=>update({target2:{strategy:e.target.value as LocatorStrategy,value:current.target2?.value||""}})}>{["css","xpath","id","name","className","tagName"].map(x=><option key={x} value={x}>{t(x)}</option>)}</select><label className="field-label">{t("Destination locator")}</label><input className="text-input" value={current.target2?.value||""} onChange={e=>update({target2:{strategy:current.target2?.strategy||"css",value:e.target.value}})} placeholder="#drop-target"/></>}
            {current.type==="uploadFile"&&<><label className="field-label">{t("Absolute file path")}</label><input className="text-input" value={current.filePath||""} onChange={e=>update({filePath:e.target.value})} placeholder={'C:\\Files\\upload.pdf'}/></>}
            {current.type==="scroll"&&<><label className="field-label">{t("Scroll distance (pixels)")}</label><input className="text-input" type="number" value={current.scrollAmount??600} onChange={e=>update({scrollAmount:Number(e.target.value)})}/></>}
            {current.type==="switchWindow"&&<><label className="field-label">{t("Tab index (zero-based)")}</label><input className="text-input" type="number" min="0" value={current.ms??0} onChange={e=>update({ms:Number(e.target.value)})}/></>}
            {current.type==="ifElse"&&<section className="form-card algorithm-card"><div className="algorithm-title"><div className="algorithm-symbol condition-symbol"><Braces size={18}/></div><div><div className="section-caption">{t("LOGIC BLOCK")}</div><h3>{t("If / else")}</h3><p>{t("Branch on extracted text, URL changes, or whether an earlier action succeeded. For failed actions, set Error handling to Continue so the Else path can run.")}</p></div></div><label className="field-label">{t("Value to check")}</label><select className="text-input" value={current.condition?.source||"lastText"} onChange={e=>{const source=e.target.value as NonNullable<Step["condition"]>["source"];update({condition:{source,operator:source==="stepStatus"||source==="urlChanged"?"equals":current.condition?.operator||"contains",key:current.condition?.key,expected:source==="stepStatus"?"success":source==="urlChanged"?"true":current.condition?.expected||""}})}}>{[["variable","Workflow variable"],["lastText","Last extracted text"],["url","Current URL"],["urlChanged","Did the URL change?"],["stepStatus","Previous action result"]].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select>{(current.condition?.source==="variable"||current.condition?.source==="stepStatus")&&<><label className="field-label">{t("Variable / step id")}</label>{current.condition?.source==="stepStatus"?<select className="text-input" value={current.condition?.key||""} onChange={e=>update({condition:{...(current.condition||{source:"stepStatus",operator:"equals"}),key:e.target.value}})}><option value="">{t("Choose an earlier action…")}</option>{steps.slice(0,Math.max(0,steps.findIndex(item=>item.id===current.id))).map(item=><option key={item.id} value={item.id}>{item.name||item.type} · {item.id.slice(0,8)}</option>)}</select>:<input className="text-input" value={current.condition?.key||""} onChange={e=>update({condition:{...(current.condition||{source:"variable",operator:"equals"}),key:e.target.value}})} placeholder="variableName"/>}</>}<div className="condition-pair"><div><label className="field-label">{t("Operator")}</label><select className="text-input" value={current.condition?.operator||"contains"} onChange={e=>update({condition:{...(current.condition||{source:"lastText"}),operator:e.target.value as NonNullable<Step["condition"]>["operator"]}})}>{["equals","notEquals","contains","notContains","matches","greaterThan","lessThan","truthy","falsy"].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></div><div><label className="field-label">{t("Expected value")}</label>{current.condition?.source==="stepStatus"?<select className="text-input" value={current.condition?.expected||"success"} onChange={e=>update({condition:{...(current.condition||{source:"stepStatus",operator:"equals"}),expected:e.target.value}})}><option value="success">{t("Succeeded")}</option><option value="error">{t("Failed")}</option><option value="skipped">{t("Skipped")}</option></select>:current.condition?.source==="urlChanged"?<select className="text-input" value={current.condition?.expected||"true"} onChange={e=>update({condition:{...(current.condition||{source:"urlChanged",operator:"equals"}),expected:e.target.value}})}><option value="true">{t("Changed")}</option><option value="false">{t("Did not change")}</option></select>:<input className="text-input" value={current.condition?.expected||""} onChange={e=>update({condition:{...(current.condition||{source:"lastText",operator:"contains"}),expected:e.target.value}})} placeholder="Value to compare"/>}</div></div><div className="branch-stack">{renderNestedSteps("thenSteps",t("If condition is true"))}{renderNestedSteps("elseSteps",t("Otherwise"))}</div><div className="hint condition-help"><Check size={14}/> <span><b>{t("True path:")}</b> {t("runs when the condition matches.")} <b>{t("Else path:")}</b> {t("runs otherwise.")} {t("For an earlier action, choose “Previous action result”, select that step ID, then use")} <code>{t("equals · success")}</code> or <code>{t("equals · error")}</code>. {t("To route a failed action into Else, set that action’s error handling to Continue.")}</span></div></section>}
            {current.type==="while"&&<section className="form-card algorithm-card"><div className="algorithm-title"><div className="algorithm-symbol loop-symbol"><RefreshCw size={18}/></div><div><div className="section-caption">{t("LOOP BLOCK")}</div><h3>{t("Repeat while true")}</h3><p>{t("Run actions until the condition no longer passes.")}</p></div></div><label className="field-label">{t("Value to check")}</label><select className="text-input" value={current.condition?.source||"lastText"} onChange={e=>{const source=e.target.value as NonNullable<Step["condition"]>["source"];update({condition:{source,operator:source==="stepStatus"||source==="urlChanged"?"equals":current.condition?.operator||"contains",key:current.condition?.key,expected:source==="stepStatus"?"success":source==="urlChanged"?"true":current.condition?.expected||""}})}}>{[["variable","Workflow variable"],["lastText","Last extracted text"],["url","Current URL"],["urlChanged","Did the URL change?"],["stepStatus","Previous action result"]].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select>{(current.condition?.source==="variable"||current.condition?.source==="stepStatus")&&<><label className="field-label">{t("Variable / step id")}</label>{current.condition?.source==="stepStatus"?<select className="text-input" value={current.condition?.key||""} onChange={e=>update({condition:{...(current.condition||{source:"stepStatus",operator:"equals"}),key:e.target.value}})}><option value="">{t("Choose an earlier action…")}</option>{steps.slice(0,Math.max(0,steps.findIndex(item=>item.id===current.id))).map(item=><option key={item.id} value={item.id}>{item.name||item.type} · {item.id.slice(0,8)}</option>)}</select>:<input className="text-input" value={current.condition?.key||""} onChange={e=>update({condition:{...(current.condition||{source:"variable",operator:"equals"}),key:e.target.value}})} placeholder="variableName"/>}</>}<div className="condition-pair"><div><label className="field-label">{t("Operator")}</label><select className="text-input" value={current.condition?.operator||"contains"} onChange={e=>update({condition:{...(current.condition||{source:"lastText"}),operator:e.target.value as NonNullable<Step["condition"]>["operator"]}})}>{["equals","notEquals","contains","notContains","matches","greaterThan","lessThan","truthy","falsy"].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></div><div><label className="field-label">{t("Expected value")}</label>{current.condition?.source==="stepStatus"?<select className="text-input" value={current.condition?.expected||"success"} onChange={e=>update({condition:{...(current.condition||{source:"stepStatus",operator:"equals"}),expected:e.target.value}})}><option value="success">{t("Succeeded")}</option><option value="error">{t("Failed")}</option><option value="skipped">{t("Skipped")}</option></select>:current.condition?.source==="urlChanged"?<select className="text-input" value={current.condition?.expected||"true"} onChange={e=>update({condition:{...(current.condition||{source:"urlChanged",operator:"equals"}),expected:e.target.value}})}><option value="true">{t("Changed")}</option><option value="false">{t("Did not change")}</option></select>:<input className="text-input" value={current.condition?.expected||""} onChange={e=>update({condition:{...(current.condition||{source:"lastText",operator:"contains"}),expected:e.target.value}})}/>}</div></div><label className="field-label">{t("Maximum iterations (safety cap)")}</label><input className="text-input" type="number" min="1" max="1000" value={current.repeatCount??100} onChange={e=>update({repeatCount:Math.max(1,Math.min(1000,Number(e.target.value)||100))})}/>{renderNestedSteps("loopSteps",t("Loop body"))}<div className="hint">{t("The condition is checked before each iteration. A safety cap prevents an endless loop.")}</div></section>}
            {current.type==="repeat"&&<section className="form-card algorithm-card"><div className="algorithm-title"><div className="algorithm-symbol loop-symbol"><RefreshCw size={18}/></div><div><div className="section-caption">{t("LOOP BLOCK")}</div><h3>{t("Repeat N times")}</h3><p>{t("Run a sequence a fixed number of times.")}</p></div></div><label className="field-label">{t("Number of iterations (1 to 1,000)")}</label><input className="text-input" type="number" min="1" max="1000" value={current.repeatCount??2} onChange={e=>update({repeatCount:Math.max(1,Math.min(1000,Number(e.target.value)||1))})}/>{renderNestedSteps("loopSteps",t("Actions to repeat"))}<div className="hint">{t("Every action in the loop body runs in order for each iteration.")}</div></section>}
            {current.type==="loopList"&&<section className="form-card algorithm-card"><div className="algorithm-title"><div className="algorithm-symbol loop-symbol"><Layers3 size={18}/></div><div><div className="section-caption">{t("ITERATION BLOCK")}</div><h3>{t("For each item")}</h3><p>{t("Run a sequence for every value in your list.")}</p></div></div><label className="field-label">{t("List values or JSON array")}</label><input className="text-input" value={current.listExpression||""} onChange={e=>update({listExpression:e.target.value})} placeholder={'alpha,beta,gamma or ["a","b"]'}/><label className="field-label">{t("Item variable name")}</label><input className="text-input" value={current.itemVariable||"item"} onChange={e=>update({itemVariable:e.target.value})} placeholder="item"/>{renderNestedSteps("loopSteps","Actions for each item")}<div className="hint">{t("The current value is exposed through the item variable while the loop body runs.")}</div></section>}
            {current.type==="regexReplace"&&<section className="user-input-config"><div className="section-caption">REGEX VARIABLE TRANSFORM</div><p className="hint">Read a literal or existing variable, apply a regular expression, then store the transformed text in an output variable. Use ${'{'}variableName{'}'} to reference variables.</p><label className="field-label">Source text / variable expression</label><input className="text-input" value={current.text||""} onChange={e=>update({text:e.target.value})} placeholder="${'{'}email{'}'}"/><label className="field-label">Regex pattern</label><input className="text-input" value={current.expected||""} onChange={e=>update({expected:e.target.value})} placeholder="(\d{3})-(\d{4})"/><label className="field-label">Replacement</label><input className="text-input" value={current.attribute||""} onChange={e=>update({attribute:e.target.value})} placeholder="$1/$2"/><label className="field-label">Regex flags</label><input className="text-input" value={current.key??"g"} onChange={e=>update({key:e.target.value})} placeholder="g, gi, gim, su, y" autoComplete="off" spellCheck={false}/><p className="hint">Standard JavaScript RegExp flags: d, g, i, m, s, u, v, y. Combine flags as needed, for example <code>gim</code>. You can also enter a slash-delimited expression such as <code>/pattern/gi</code> in the pattern field.</p><label className="field-label">Output variable</label><input className="text-input" value={current.outputName||"result"} onChange={e=>update({outputName:e.target.value})} placeholder="cleanedValue"/></section>}{current.type==="setVariable"&&<section className="form-card algorithm-card"><div className="section-caption">{t("VARIABLES")}</div><h3>{t("Set a variable")}</h3><p>Store text or a value built from existing variables. Use $&#123;variableName&#125; to reference another variable.</p><label className="field-label">{t("Variable name")}</label><input className="text-input" value={current.outputName||"result"} onChange={e=>update({outputName:e.target.value})} placeholder="customerName"/><label className="field-label">{t("Value")}</label><textarea className="text-input" rows={3} value={current.text||""} onChange={e=>update({text:e.target.value})} placeholder="${firstName} ${lastName}"/></section>}
            {current.type==="extractAll"&&<section className="form-card algorithm-card"><div className="section-caption">{t("COLLECT MATCHING ELEMENTS")}</div><h3>{t("Select all matching elements")}</h3><p>{t("Collect every matching element into a JSON array variable and a .json output artifact.")}</p><label className="field-label">{t("Extract")}</label><select className="text-input" value={current.bulkOperation||"extractText"} onChange={e=>update({bulkOperation:e.target.value as Step["bulkOperation"]})}><option value="extractText">{t("Visible text")}</option><option value="extractAttribute">{t("Attribute value")}</option><option value="extractValue">{t("Input value")}</option></select>{current.bulkOperation==="extractAttribute"&&<><label className="field-label">{t("Attribute name")}</label><input className="text-input" value={current.attribute||"href"} onChange={e=>update({attribute:e.target.value})}/></>}<label className="field-label">{t("Save array to variable")}</label><input className="text-input" value={current.outputName||"result"} onChange={e=>update({outputName:e.target.value})} placeholder="items"/><div className="hint">Uses the locator above. CSS examples: <code>li.product</code>, <code>.price</code>, <code>#results a</code>, or <code>button</code>. Maximum 5,000 elements.</div></section>}
            {current.type==="operateAll"&&<section className="form-card algorithm-card"><div className="section-caption">{t("BULK ACTION")}</div><h3>{t("Operate on every match")}</h3><p>{t("Apply one operation to all elements matched by the locator.")}</p><label className="field-label">{t("Operation")}</label><select className="text-input" value={current.bulkOperation||"click"} onChange={e=>update({bulkOperation:e.target.value as Step["bulkOperation"]})}><option value="click">{t("Click each match")}</option><option value="type">{t("Type into each match")}</option><option value="extractText">{t("Collect text into a variable")}</option><option value="extractAttribute">{t("Collect attribute into a variable")}</option><option value="extractValue">{t("Collect input values into a variable")}</option></select>{current.bulkOperation==="type"&&<><label className="field-label">{t("Text to type")}</label><textarea className="text-input" rows={2} value={current.text||""} onChange={e=>update({text:e.target.value})}/></>}{current.bulkOperation==="extractAttribute"&&<><label className="field-label">{t("Attribute name")}</label><input className="text-input" value={current.attribute||"href"} onChange={e=>update({attribute:e.target.value})}/></>}{(current.bulkOperation||"click").startsWith("extract")&&<><label className="field-label">{t("Save results to variable")}</label><input className="text-input" value={current.outputName||"result"} onChange={e=>update({outputName:e.target.value})} placeholder="results"/></>}<div className="hint">{t("Bulk click/type is limited to 1,000 elements. Test your selector with a small set first.")}</div></section>}
            {current.type==="uploadFile"&&<section className="form-card upload-file-card"><div className="algorithm-title"><div className="algorithm-symbol upload-symbol"><FolderOpen size={18}/></div><div><div className="section-caption">{t("FILE UPLOAD")}</div><h3>{t("Choose a local file")}</h3><p>{t("FlowForge sends the file path to the page's file input.")}</p></div></div><label className="field-label">{t("File path")}</label><div className="file-picker-row"><input className="text-input" value={current.filePath||""} onChange={e=>update({filePath:e.target.value})} placeholder={String.raw`C:\Users\you\Documents\file.pdf`}/><button className="secondary-button" onClick={async()=>{const result=await window.flowforge.chooseFile();if(result?.path)update({filePath:result.path});else if(result?.error)setLogs(old=>[...old,result.error!].slice(-300))}}><FolderOpen size={14}/> {t("Browse")}</button></div><div className="hint">{t("Choose the file input as the target locator. The path stays on this computer until the workflow uploads it to the website.")}</div></section>}
            {current.type==="scrollTo"&&<div className="hint">{t("Scrolls the selected element into the center of the viewport before continuing.")}</div>}
            {current.type==="waitDownload"&&<div className="hint">{t("Downloads are routed to this workflow's output folder and included in the ZIP.")}</div>}

            {current.type!=="navigate"&&<><label className="field-label">{t("Timeout (ms)")}</label><input className="text-input" type="number" value={current.timeout||10000} onChange={e=>update({timeout:Number(e.target.value)})}/></>}
            <label className="field-label">{t("On error")}</label><div className="select-wrap"><select className="text-input" value={current.onError||"stop"} onChange={e=>update({onError:e.target.value as OnErrorPolicy})}><option value="stop">{t("Stop workflow")}</option><option value="continue">{t("Continue to next step")}</option></select><ChevronDown size={14}/></div>
            <label className="field-label">{t("Retry attempts")}</label><input className="text-input" aria-label="Retry attempts" type="number" min="1" max="10" value={current.retry?.attempts ?? 1} onChange={e=>{const attempts=Math.max(1,Math.min(10,Number(e.target.value)||1));update({retry:attempts>1||current.retry?{attempts,delayMs:current.retry?.delayMs??500}:undefined})}}/><label className="field-label">{t("Delay between retries (ms)")}</label><input className="text-input" aria-label="Retry delay in milliseconds" type="number" min="0" max="30000" value={current.retry?.delayMs ?? 500} onChange={e=>update({retry:{attempts:current.retry?.attempts??1,delayMs:Math.max(0,Math.min(30000,Number(e.target.value)||0))}})}/>
            <label className="check-row"><input type="checkbox" checked={!!current.disabled} onChange={e=>update({disabled:e.target.checked})}/> {t("Disable this step")}</label>
            <div className="editor-bottom"><span><Code2 size={14}/> Selenium WebDriver</span><span>Step ID: {current.id.slice(0,8)}</span></div>
            <section className="variables-panel"><div className="section-caption">{t("WORKFLOW VARIABLES")}</div><p className="hint">Variables persist with this workflow. Reference values in text fields with <code>${"{variableName}"}</code>; extracted collections are stored as JSON strings.</p><button className="secondary-button" onClick={addVariable}><Plus size={12}/> {t("Add variable")}</button>{variables.map(v=><div className="variable-row" key={v.id}><input className="text-input" value={v.name} aria-label="Variable name" onChange={e=>setVariables(all=>all.map(x=>x.id===v.id?{...x,name:e.target.value}:x))} placeholder="name"/><input className="text-input" value={v.value} aria-label="Variable value" onChange={e=>setVariables(all=>all.map(x=>x.id===v.id?{...x,value:e.target.value}:x))} placeholder="value"/><button className="tiny-icon always-visible" title="Delete variable" onClick={()=>setVariables(all=>all.filter(x=>x.id!==v.id))}><Trash2 size={13}/></button></div>)}</section>
            <section className={`validation-panel ${validation.valid?"is-valid":"has-errors"}`}><div className="validation-title">{validation.valid?"Workflow validation passed":"Workflow needs attention"}</div>{validation.errors.slice(0,8).map((error,i)=><div className="validation-item" key={`${i}-${error}`}>{error}</div>)}{validation.warnings.map((warning,i)=><div className="validation-warning" key={`${i}-${warning}`}>{warning}</div>)}</section>
          </div>:<div className="empty-state">{t("Add a step to begin building your workflow.")}</div>}
        </main>
        <div className="panel-resizer" role="separator" aria-orientation="vertical" aria-label={t("Resize run status panel")} onMouseDown={event=>beginResize("right",event,rightWidth)} />
        <aside className={`right-panel ${rightCollapsed?"panel-collapsed":""}`} style={{width:rightCollapsed?44:rightWidth,minWidth:rightCollapsed?44:250}}>
          <div className="right-heading"><button className="square-button panel-collapse-button" onClick={()=>setRightCollapsed(v=>!v)} title={rightCollapsed?t("Expand run status"):t("Collapse run status")} aria-label={rightCollapsed?t("Expand run status"):t("Collapse run status")}><ChevronDown size={15}/></button>{!rightCollapsed&&<><Activity size={16}/><span>{t("Run status")}</span><span className="status-pill">{running?"RUNNING":"IDLE"}</span></>}</div>
          {!rightCollapsed&&<>
          <div className="run-summary"><div className="summary-number">{Object.values(runState).filter(s=>s==="success").length}<span>/{steps.length}</span></div><div className="summary-label">{t("steps completed")}</div><div className="progress"><div style={{width:`${steps.length?Object.values(runState).filter(s=>s==="success").length/steps.length*100:0}%`}}/></div></div>
          <div className="section-caption">{t("BROWSER TARGET")}</div><div className="browser-select"><AppWindow size={17}/><div><strong>{browser==="chrome"?"Google Chrome":"Microsoft Edge"}</strong><small>{t("Real desktop browser")}</small></div><ChevronDown size={14}/><select aria-label="Browser" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">{t("Chrome")}</option><option value="edge">{t("Edge")}</option></select></div>
          <div className="section-caption">{t("START URL")}</div><input className="text-input" value={startUrl} onChange={e=>setStartUrl(e.target.value)} placeholder="https://…"/>
          <div className="section-caption">{t("OPTIMIZATIONS")}</div><label className="setting-row"><span><strong>{t("Disable images")}</strong><small>{t("Reduce bandwidth and page load")}</small></span><input type="checkbox" checked={disableImages} onChange={e=>setDisableImages(e.target.checked)}/></label><label className="setting-row"><span><strong>{t("Disable CSS")}</strong><small>{t("Experimental, may break layouts")}</small></span><input type="checkbox" checked={disableCss} onChange={e=>setDisableCss(e.target.checked)}/></label><label className="setting-row"><span><strong>{t("Disable fonts")}</strong><small>{t("Block web font files")}</small></span><input type="checkbox" checked={disableFonts} onChange={e=>setDisableFonts(e.target.checked)}/></label><label className="setting-row"><span><strong>{t("Disable media")}</strong><small>{t("Block audio and video files")}</small></span><input type="checkbox" checked={disableMedia} onChange={e=>setDisableMedia(e.target.checked)}/></label><label className="setting-row"><span><strong>{t("Headless browser")}</strong><small>{t("Run Chrome/Edge without showing a browser window")}</small></span><input type="checkbox" checked={headless} onChange={e=>setHeadless(e.target.checked)}/></label><label className="field-label">{t("Page load strategy")}</label><select className="text-input" aria-label="Page load strategy" value={pageLoadStrategy} onChange={e=>setPageLoadStrategy(e.target.value)}><option value="normal">{t("Normal · wait for load")}</option><option value="eager">{t("Eager · wait for DOM ready")}</option><option value="none">{t("None · return immediately")}</option></select><label className="setting-row"><span><strong>{t("Close browser after run")}</strong><small>{t("Keep open to inspect results")}</small></span><input type="checkbox" checked={closeBrowser} onChange={e=>setCloseBrowser(e.target.checked)}/></label>
          <div className="console-head"><span><Terminal size={14}/> {t("ENGINE OUTPUT")}</span><button className="text-action" onClick={()=>setLogs([])}><Trash2 size={12}/> {t("Clear")}</button></div><div className="console">{logs.slice(-14).map((l,i)=><div key={i} className="log-line"><span>{String(i+1).padStart(2,"0")}</span><code>{l}</code></div>)}</div>
          <button className="full-run" onClick={run} disabled={running||!validation.valid||steps.length===0}><Play size={14} fill="currentColor"/>{running?"Automation running":"Run automation"}</button>
          </>}
        </aside>
      </>}
      {tab==="library"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("LOCAL WORKFLOW LIBRARY")}</div><h1>{t("Workflows")}</h1><p>{t("Create, edit, duplicate, import and share independent workflows. Changes save locally as you edit.")}</p></div><div className="button-row"><button className="secondary-button" onClick={importWorkflow}><FolderOpen size={14}/> {t("Import JSON")}</button><button className="primary-button" onClick={newWorkflow}><Plus size={14}/> {t("New workflow")}</button></div></div><div className="workflow-library-grid">{workflowLibrary.map(item=><article className={`workflow-library-card ${item.id===workflowId?"is-active":""}`} key={item.id}><div className="workflow-library-card-head"><div className="template-card-icon"><Layers3 size={18}/></div><span className="status-pill">{item.id===workflowId?"OPEN":"SAVED"}</span></div><h2>{item.document.name}</h2><p>{item.document.startUrl||"No start URL configured"}</p><div className="template-meta">{item.document.steps.length} steps · {item.document.browser} · Updated {new Date(item.updatedAt).toLocaleDateString(dateLocale)}</div><div className="button-row"><button className="primary-button" onClick={()=>activateWorkflow(item)}>{item.id===workflowId?"Continue editing":"Open & edit"}</button><button className="secondary-button" title="Duplicate workflow" onClick={()=>duplicateWorkflow(item)}><Copy size={13}/></button><button className="secondary-button" title="Export workflow and referenced sub-workflows" onClick={()=>exportWorkflowFor(item)}><Save size={13}/></button><button className="secondary-button" title="View this workflow's output ZIPs" onClick={()=>{activateWorkflow(item);setTab("outputs")}}><Archive size={13}/></button><button className="secondary-button" title="Delete workflow" onClick={()=>deleteWorkflow(item.id)} disabled={workflowLibrary.length<=1}><Trash2 size={13}/></button></div></article>)}</div><div className="warning-card">{t("Workflow files may contain typed values and personal data. Review JSON before sharing. Imported workflow packages remap workflow IDs so their sub-workflow references stay connected.")}</div></main>}
      {tab==="outputs"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("WORKFLOW ARTIFACTS")}</div><h1>{t("Outputs")}</h1><p>{t("Text, extracted data, screenshots, images and completed downloads are collected into a ZIP for this workflow.")}</p></div><button className="secondary-button" onClick={()=>setOutputRefreshToken(v=>v+1)}><RefreshCw size={14}/> {t("Refresh")}</button></div><div className="output-context form-card"><div className="section-caption">{t("CURRENT WORKFLOW")}</div><strong>{workflowName}</strong><p className="hint">{t("Each successful or failed run attempts to create a separate ZIP archive in FlowForge's local application data folder.")}</p></div>{outputArchives.length===0?<div className="empty-state"><Archive size={24}/><p>{t("No output ZIPs yet.")}</p><span>{t("Run this workflow with a screenshot, extract, save-text, or download action to generate output files.")}</span></div>:<div className="output-archive-list">{outputArchives.map(archive=><article className="form-card output-archive-card" key={archive.name}><div className="output-archive-heading"><div className="output-archive-icon"><Archive size={21}/></div><div className="output-archive-title"><strong>{archive.name}</strong><span>{(archive.size/1024).toFixed(1)} KB · {new Date(archive.modifiedAt).toLocaleString(dateLocale)} · {archive.artifacts.length} artifacts</span></div></div><div className="output-artifact-list">{archive.artifacts.map(artifact=><div className="output-artifact-row" key={artifact.name}><span><FileText size={14}/>{artifact.name}<small>{(artifact.size/1024).toFixed(1)} KB</small></span><button className="tiny-icon always-visible" title="Preview output" onClick={async()=>{const r=await window.flowforge.readOutput(workflowId,archive.name,artifact.name);if(!r.ok){setLogs(old=>[...old,r.error||"Preview failed"].slice(-300));return;}setOutputPreview({archive:archive.name,name:artifact.name,mime:r.mime||"application/octet-stream",data:r.data||"",text:r.text})}}><Eye size={14}/></button></div>)}</div><div className="button-row"><button className="primary-button" onClick={async()=>{const r=await window.flowforge.openOutput(workflowId,archive.name);if(!r.ok)setLogs(old=>[...old,r.error||"Could not open ZIP"].slice(-300))}}><Download size={14}/> {t("Open ZIP")}</button><button className="secondary-button" onClick={()=>void window.flowforge.revealOutput(workflowId,archive.name)}><FolderOpen size={14}/> {t("Show in folder")}</button><button className="secondary-button danger-button" onClick={async()=>{if(!confirm(`Delete ${archive.name} and its preview files?`))return;await window.flowforge.deleteOutput(workflowId,archive.name);setOutputPreview(p=>p?.archive===archive.name?null:p);setOutputRefreshToken(v=>v+1)}}><Trash2 size={14}/> {t("Delete")}</button></div></article>)}</div>}{outputPreview&&<section className="form-card output-preview"><div className="history-title-row"><strong>Preview: {outputPreview.name}</strong><button className="tiny-icon always-visible" onClick={()=>setOutputPreview(null)} title="Close preview"><Square size={13}/></button></div>{outputPreview.mime.startsWith("image/")?<img className="output-image-preview" alt={outputPreview.name} src={`data:${outputPreview.mime};base64,${outputPreview.data}`}/>:outputPreview.text!==undefined?<pre className="output-text-preview">{outputPreview.text}</pre>:<div className="hint">{t("This file type cannot be previewed in the app. Open the ZIP to inspect it.")}</div>}</section>}<div className="warning-card">{t("Output archives may contain personal data, screenshots, or downloaded files. Review them before sharing. Preview is limited to 10 MB per file.")}</div></main>}
      {tab==="templates"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("WORKFLOW LIBRARY")}</div><h1>{t("Templates")}</h1><p>{t("Start from a practical pattern, then replace sample URLs and selectors with your own target.")}</p></div></div><div className="template-grid"><article className="template-card"><div className="template-card-icon"><ShieldCheck size={19}/></div><div className="eyebrow">{t("BASIC VALIDATION")}</div><h2>{t("Website smoke check")}</h2><p>{t("Open a page, wait for its main heading, and assert expected text. Uses example.com as a safe placeholder.")}</p><div className="template-meta">3 steps · Navigate · Wait · Assert</div><button className="primary-button" onClick={()=>applyTemplate("starter")}>{t("Use template")}</button></article><article className="template-card"><div className="template-card-icon"><FileText size={19}/></div><div className="eyebrow">{t("FORM AUTOMATION")}</div><h2>{t("Form entry starter")}</h2><p>{t("Demonstrates waiting for an email field, typing a value, and submitting a form. Update selectors before use.")}</p><div className="template-meta">4 steps · Navigate · Wait · Type · Click</div><button className="primary-button" onClick={()=>applyTemplate("form")}>{t("Use template")}</button></article><article className="template-card"><div className="template-card-icon"><Search size={19}/></div><div className="eyebrow">{t("SEARCH AUTOMATION")}</div><h2>{t("Search page starter")}</h2><p>{t("Demonstrates locating a search box, entering a query, and pressing Enter. Replace the example selectors.")}</p><div className="template-meta">4 steps · Navigate · Wait · Type · Key</div><button className="primary-button" onClick={()=>applyTemplate("search")}>{t("Use template")}</button></article></div><div className="warning-card">{t("Templates are starter examples, not site-specific automations. They may fail until you configure selectors for the website you are authorized to automate.")}</div></main>}
      {tab==="browser"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("LIVE TARGETING")}</div><h1>{t("Browser & selector")}</h1><p>{t("Launch a real Chrome or Edge window, then use the selector helper.")}</p></div></div><div className="feature-card"><div className="feature-icon"><MousePointer2 size={20}/></div><div><h3>{t("Visual record selector")}</h3><p>{t("The production selector uses a small browser extension/content script to paint a 40% red hover overlay and capture XPath/CSS when you click an element. This starter UI defines the workflow integration point; the extension bridge still needs to be installed and wired.")}</p><div className="selector-demo"><div className="selector-demo-bar"><span/><span/><span/><code>https://your-site.example</code></div><div className="selector-demo-page"><div className="demo-hover"><b>{t("Hover target preview")}</b><span>40% red overlay</span></div><div className="demo-lines"><i/><i/><i/></div><button onClick={()=>setLogs(old=>[...old,"Selector bridge is not connected yet. See docs/ROADMAP.md."])}>{t("Capture selected element")}</button></div></div></div></div><div className="info-grid"><div className="mini-card"><MousePointer2 size={17}/><b>{t("XPath + CSS")}</b><p>{t("Store a stable locator per action.")}</p></div><div className="mini-card"><Globe2 size={17}/><b>{t("Actual browser")}</b><p>{t("Selenium launches installed Chrome or Edge.")}</p></div><div className="mini-card"><ShieldCheck size={17}/><b>{t("Local-first")}</b><p>{t("Workflows and profiles stay on this PC.")}</p></div></div></main>}
      {tab==="profiles"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("IDENTITY & STORAGE")}</div><h1>{t("Browser profiles")}</h1><p>{t("Keep browser identity separate between workflows.")}</p></div><button className="primary-button" onClick={saveProfile}><Save size={14}/> {t("Save profile")}</button></div><div className="form-card"><label className="field-label">{t("Profile name")}</label><input className="text-input" value={profileName} onChange={e=>setProfileName(e.target.value)}/><label className="field-label">{t("Browser")}</label><select className="text-input" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">{t("Google Chrome")}</option><option value="edge">{t("Microsoft Edge")}</option></select><label className="field-label">{t("Persistent user data directory (optional)")}</label><input className="text-input" value={userDataDir} onChange={e=>setUserDataDir(e.target.value)} placeholder="C:\\FlowForge\\profiles\\work"/><div className="hint"><ShieldCheck size={13}/> {t("For persistent cookies and storage, use a dedicated automation profile directory. Do not point this at a browser profile that is currently open.")}</div><button className="primary-button" onClick={saveProfile}><Save size={14}/> {t("Save profile settings")}</button></div><div className="form-card"><div className="section-caption">{t("PORTABLE SESSION SNAPSHOT")}</div><p className="hint">{t("Export or restore cookies and local/session storage for the current site origin. Start a browser session first. Import navigates to the snapshot origin before restoring state.")}</p><div className="button-row"><button className="primary-button" onClick={exportSession} disabled={!running}><Save size={14}/> {t("Export session JSON")}</button><button className="secondary-button" onClick={importSession} disabled={!running}><FolderOpen size={14}/> {t("Import session JSON")}</button></div><p className="hint"><ShieldCheck size={13}/> {t("Session files contain authentication secrets. They are plain JSON, not encrypted. Store them securely and never commit them to source control. Only one origin is captured per snapshot.")}</p></div><div className="warning-card">{t("Profile metadata and session snapshots are separate. The snapshot does not include passwords, browser cache, or other origins. Expired cookies are skipped; cookies outside the snapshot host scope are rejected.")}</div></main>}
      {tab==="settings"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("ENGINE CONFIGURATION")}</div><h1>{t("Settings")}</h1><p>{t("Control how the automation engine behaves.")}</p></div></div><div className="form-card"><div className="setting-row"><span><strong>{t("Disable images")}</strong><small>{t("Lower bandwidth and speed up page loads.")}</small></span><input type="checkbox" checked={disableImages} onChange={e=>setDisableImages(e.target.checked)}/></div><div className="setting-row"><span><strong>{t("Disable CSS")}</strong><small>{t("Blocks stylesheet requests; may break page layouts.")}</small></span><input type="checkbox" checked={disableCss} onChange={e=>setDisableCss(e.target.checked)}/></div><div className="setting-row"><span><strong>{t("Disable web fonts")}</strong><small>{t("Block WOFF/TTF/OTF requests.")}</small></span><input type="checkbox" checked={disableFonts} onChange={e=>setDisableFonts(e.target.checked)}/></div><div className="setting-row"><span><strong>{t("Disable audio/video")}</strong><small>{t("Block common media file requests.")}</small></span><input type="checkbox" checked={disableMedia} onChange={e=>setDisableMedia(e.target.checked)}/></div><label className="setting-row"><span><strong>{t("Headless browser")}</strong><small>{t("Run Chrome/Edge without showing a browser window")}</small></span><input type="checkbox" checked={headless} onChange={e=>setHeadless(e.target.checked)}/></label><label className="field-label">{t("Page load strategy")}</label><select className="text-input" value={pageLoadStrategy} onChange={e=>setPageLoadStrategy(e.target.value)}><option value="normal">{t("Normal · wait for load")}</option><option value="eager">{t("Eager · wait for DOM ready")}</option><option value="none">{t("None · return immediately")}</option></select><div className="setting-row"><span><strong>{t("Close browser after run")}</strong><small>{t("Close WebDriver session when the workflow finishes.")}</small></span><input type="checkbox" checked={closeBrowser} onChange={e=>setCloseBrowser(e.target.checked)}/></div><label className="field-label">{t("Default browser")}</label><select className="text-input" value={browser} onChange={e=>setBrowser(e.target.value)}><option value="chrome">{t("Chrome")}</option><option value="edge">{t("Edge")}</option></select><div className="section-caption schedule-section-title">AUTOMATIC JOBS</div><p className="hint">Schedule the currently open workflow. Repeat timers run while FlowForge is open. Windows startup launches the app at sign-in and triggers one run.</p><label className="setting-row"><span><strong>Repeat automatically</strong><small>Run the current workflow on a repeating timer</small></span><input type="checkbox" checked={scheduleEnabled} onChange={e=>setScheduleEnabled(e.target.checked)}/></label><div className="schedule-controls"><input className="text-input" type="number" min="1" max="100000" value={scheduleEvery} onChange={e=>setScheduleEvery(Math.max(1,Number(e.target.value)||1))}/><select className="text-input" value={scheduleUnit} onChange={e=>setScheduleUnit(e.target.value)}><option value="seconds">Every seconds</option><option value="minutes">Every minutes</option><option value="hours">Every hours</option><option value="days">Every days</option></select></div><label className="setting-row"><span><strong>Run at Windows startup</strong><small>Launch FlowForge at sign-in and run once using the currently saved workflow</small></span><input type="checkbox" checked={scheduleStartup} onChange={async e=>{const enabled=e.target.checked;setScheduleStartup(enabled);const result=await window.flowforge.setLaunchAtLogin(enabled);if(!result.ok)setLogs(old=>[...old,`Could not update Windows startup setting: ${result.error||"unknown error"}`])}}/></label></div><section className="form-card about-card"><div className="section-caption">{t("About FlowForge")}</div><h2>FlowForge <span className="about-version">v0.3.24</span></h2><p className="hint">{t("Maintainer")}: <strong>Amirreza Taati</strong> <span>(Jelofen1962)</span></p><div className="button-row"><button className="secondary-button" onClick={()=>window.flowforge.openExternal("https://github.com/Jelofen1962")}><Globe2 size={14}/> GitHub · Jelofen1962</button><button className="secondary-button" onClick={()=>window.flowforge.openExternal("https://t.me/Jelofen1962")}>Telegram · Jelofen1962</button></div><div className="update-settings-row"><div><strong>{t("Check for updates")}</strong><small>{updateMessage||t("Checks the latest stable release on GitHub.")}</small></div><button className="primary-button" disabled={updateChecking} onClick={()=>void checkForUpdates(true)}><RefreshCw size={14} className={updateChecking?"spin":""}/>{updateChecking?t("Checking for updates…"):t("Check for updates")}</button></div></section></main>}
      {tab==="history"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("EXECUTION DIAGNOSTICS")}</div><h1>{t("Run history")}</h1><p>{t("Recent automation outcomes are stored locally on this device.")}</p></div><button className="secondary-button" onClick={()=>{setRunHistory([]);activeRunId.current=null}}>{t("Clear history")}</button></div>{runHistory.length===0?<div className="empty-state">{t("No runs recorded yet. Run a workflow to start building history.")}</div>:<div className="history-list">{runHistory.map(item=><article className="form-card" key={item.id}><div className="history-title-row"><strong>{item.workflow}</strong><span className={`status-pill ${item.status}`}>{t(item.status)}</span></div><div className="hint">Started {new Date(item.startedAt).toLocaleString(dateLocale)} · {item.durationMs===undefined?"In progress":`${(item.durationMs/1000).toFixed(1)}s`}</div><div className="history-stats"><span>{item.successfulSteps} {t("succeeded")}</span><span>{item.failedSteps} {t("failed")}</span><span>{item.skippedSteps} {t("skipped")}</span><span>{item.totalSteps} {t("total")}</span></div>{item.error&&<div className="validation-item">{item.error}</div>}</article>)}</div>}</main>}
      {tab==="logs"&&<main className="single-panel"><div className="panel-heading"><div><div className="eyebrow">{t("DIAGNOSTICS")}</div><h1>{t("Engine logs")}</h1><p>{t("Live output from the local Selenium runner.")}</p></div><button className="secondary-button" onClick={()=>setLogs([])}>{t("Clear logs")}</button></div><div className="console large-console">{logs.map((l,i)=><div key={i} className="log-line"><span>{String(i+1).padStart(3,"0")}</span><code>{l}</code></div>)}</div></main>}
    </div>
    {userInputPrompt&&<div className="user-input-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)void cancelUserInput()}}><section className="user-input-dialog" role="dialog" aria-modal="true" aria-labelledby="user-input-dialog-title"><div className="user-input-dialog-icon"><Braces size={22}/></div><div className="eyebrow">{t("FLOWFORGE NEEDS YOUR INPUT")}</div><h2 id="user-input-dialog-title">{userInputPrompt.stepName}</h2><p className="user-input-intro">{t("Enter the values below. FlowForge will place each value into its configured webpage field and continue the workflow.")}</p><form onSubmit={event=>{event.preventDefault();void submitUserInput()}}>{userInputPrompt.fields.map(field=><label className="prompt-field" key={field.id}><span>{field.title}{field.required&&<b> *</b>}</span>{field.valueType==="boolean"?<select className="text-input" aria-label={field.title} value={userInputPrompt.values[field.id]||""} required={field.required} onChange={event=>setUserInputPrompt(prompt=>prompt?{...prompt,values:{...prompt.values,[field.id]:event.target.value},error:undefined}:prompt)}><option value="">Choose true or false</option><option value="true">True</option><option value="false">False</option></select>:<input autoFocus={userInputPrompt.fields[0]?.id===field.id} type={field.secret?"password":field.valueType==="number"?"number":"text"} value={userInputPrompt.values[field.id]||""} placeholder={field.placeholder||"Enter a value"} required={field.required} onChange={event=>setUserInputPrompt(prompt=>prompt?{...prompt,values:{...prompt.values,[field.id]:event.target.value},error:undefined}:prompt)}/>}</label>)}{userInputPrompt.error&&<div className="user-input-error" role="alert">{userInputPrompt.error}</div>}<div className="user-input-actions"><button className="secondary-button" type="button" onClick={()=>void cancelUserInput()}>{t("Cancel workflow step")}</button><button className="primary-button" type="submit"><Check size={15}/> {t("Continue workflow")}</button></div></form><div className="user-input-footnote"><ShieldCheck size={13}/> {t("Values are sent only to the local FlowForge engine and are not added to run logs.")}</div></section></div>}
    {updateInfo&&<div className="user-input-backdrop update-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setUpdateInfo(null)}}><section className="user-input-dialog update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title"><div className="user-input-dialog-icon"><RefreshCw size={22}/></div><div className="eyebrow">{t("A new version is available")}</div><h2 id="update-dialog-title">FlowForge {updateInfo.latestVersion?`v${updateInfo.latestVersion}`:""}</h2><div className="update-version-grid"><div><small>{t("Current version")}</small><strong>{updateInfo.currentVersion||"0.3.24"}</strong></div><div><small>{t("Latest version")}</small><strong>{updateInfo.latestVersion||""}</strong></div></div>{updateInfo.notes&&<div className="release-notes"><strong>{t("Release notes")}</strong><p>{updateInfo.notes}</p></div>}<div className="user-input-actions"><button className="secondary-button" onClick={()=>setUpdateInfo(null)}>{t("Later")}</button><button className="primary-button" onClick={()=>{if(updateInfo.url)window.flowforge.openExternal(updateInfo.url);setUpdateInfo(null)}}><Globe2 size={14}/>{t("View release")}</button></div></section></div>}
    {commandOpen&&<div className="command-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCommandOpen(false)}}><section className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title"><div className="command-search-row"><Search size={17}/><input ref={commandInputRef} value={commandQuery} onChange={event=>setCommandQuery(event.target.value)} placeholder={t("Search commands…")} aria-label={t("Search commands…")} onKeyDown={event=>{if(event.key==="Enter"&&filteredCommands[0]){event.preventDefault();filteredCommands[0].run()}}}/><kbd>ESC</kbd></div><div className="command-dialog-title" id="command-title">{t("COMMAND PALETTE")}</div><div className="command-results" role="listbox" aria-label={t("Commands")}>{filteredCommands.length?filteredCommands.map(item=><button className="command-result" key={item.label} onClick={item.run} role="option"><span><strong>{t(item.label)}</strong><small>{t(item.detail)}</small></span><span className="command-enter">↵</span></button>):<div className="command-empty">{t("No matching commands.")}</div>}</div><div className="command-footer"><span><kbd>Ctrl K</kbd> {t("toggle palette")}</span><span><kbd>Enter</kbd> {t("run first match")}</span><span><kbd>Esc</kbd> {t("close")}</span></div></section></div>}
    <footer className="statusbar"><span><span className="live-dot"/> {t("Ready")}</span><span>SELENIUM WEBDRIVER <b>·</b> REACT <b>·</b> ELECTRON</span><span>v0.3.24 · Jelofen1962</span></footer>
  </div>
}
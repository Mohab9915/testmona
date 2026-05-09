#!/usr/bin/env python3
"""
Seed database with Persian/Farsi test data
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Project, TestSuite, TestCaseSection, TestCase, Status, TestType
from app.models import Priority


def generate_persian_description(test_type):
    """Generate realistic Persian description based on test type"""
    descriptions = {
        "manual": "این تست به صورت دستی انجام می‌شود و نیازمند بررسی توسط تستر است",
        "automated": "این تست به صورت خودکار توسط اسکریپت‌های تست اجرا می‌شود",
        "integration": "این تست برای بررسی یکپارچگی بین ماژول‌های مختلف سیستم است",
        "security": "این تست برای بررسی آسیب‌پذیری‌های امنیتی سیستم است",
        "performance": "این تست برای بررسی عملکرد و سرعت سیستم است",
        "regression": "این تست برای اطمینان از عدم بروز مشکل در نسخه‌های جدید است",
        "smoke": "این تست برای بررسی عملکرد اصلی سیستم است"
    }
    return descriptions.get(test_type, "تست استاندارد برای بررسی عملکرد سیستم")


def generate_persian_preconditions(title):
    """Generate realistic Persian preconditions based on test title"""
    if "ورود موفق" in title:
        return "کاربر دارای حساب کاربری فعال است و در صفحه ورود به سیستم قرار دارد"
    elif "ورود ناموفق" in title:
        return "کاربر در صفحه ورود به سیستم قرار دارد اما اعتبارنامه‌های نادرست دارد"
    elif "احراز هویت دو مرحله‌ای" in title:
        return "کاربر وارد شده است و قابلیت احراز هویت دو مرحله‌ای برای حساب کاربری فعال است"
    elif "کد OTP" in title:
        return "کاربر احراز هویت دو مرحله‌ای را فعال کرده و کد OTP دریافت کرده است"
    elif "ثبت‌نام" in title:
        return "کاربر در صفحه ثبت‌نام جدید قرار دارد و تمام اطلاعات شخصی را آماده دارد"
    elif "انتقال" in title:
        return "کاربر وارد شده است و حساب بانکی با موجودی کافی دارد"
    elif "پرداخت" in title:
        return "کاربر در صفحه پرداخت قرار دارد و سبد خرید دارای محصولات انتخاب شده است"
    elif "سبد خرید" in title or "افزودن محصول" in title:
        return "کاربر وارد شده است و در صفحه محصول یا دسته‌بندی محصولات قرار دارد"
    elif "نمره" in title:
        return "دانش‌آموز در سیستم ثبت‌نام شده و به کلاس مربوطه تخصیص داده شده است"
    elif "کلاس" in title:
        return "دانش‌آموز در سیستم ثبت‌نام شده و اطلاعات کلاس‌ها در دسترس است"
    else:
        return "سیستم در حالت عادی و پایدار قرار دارد و تمام سرویس‌های مورد نیاز فعال هستند"


def generate_persian_steps(title, test_type):
    """Generate realistic Persian test steps based on test title and type"""
    if "ورود موفق" in title:
        return """1. مرورگر را باز کرده و آدرس صفحه ورود سیستم را وارد کنید
2. نام کاربری معتبر را در فیلد نام کاربری وارد کنید
3. رمز عبور صحیح را در فیلد رمز عبور وارد کنید
4. دکمه ورود را کلیک کنید
5. اطمینان حاصل کنید که به صفحه داشبورد کاربر هدایت می‌شوید
6. اطلاعات کاربر در داشبورد را بررسی کنید"""
    elif "ورود ناموفق" in title:
        return """1. مرورگر را باز کرده و آدرس صفحه ورود سیستم را وارد کنید
2. نام کاربری را در فیلد نام کاربری وارد کنید
3. رمز عبور اشتباه یا نامعتبر را در فیلد رمز عبور وارد کنید
4. دکمه ورود را کلیک کنید
5. بررسی کنید که پیام خطای مناسب نمایش داده می‌شود
6. اطمینان حاصل کنید که کاربر وارد سیستم نمی‌شود"""
    elif "احراز هویت دو مرحله‌ای" in title:
        return """1. به صفحه تنظیمات حساب کاربری بروید
2. بخش امنیت را پیدا کنید
3. گزینه فعال‌سازی احراز هویت دو مرحله‌ای را انتخاب کنید
4. روش احراز هویت (SMS، ایمیل یا اپلیکیشن) را انتخاب کنید
5. کد تایید را وارد کنید
6. اطمینان حاصل کنید که احراز هویت دو مرحله‌ای فعال شده است"""
    elif "کد OTP" in title:
        return """1. وارد حساب کاربری شوید
2. کد OTP ارسال شده را دریافت کنید
3. کد OTP صحیح را در فیلد مربوطه وارد کنید
4. دکمه تایید را کلیک کنید
5. بررسی کنید که ورود موفقیت‌آمیز است"""
    elif "ثبت‌نام" in title:
        return """1. به صفحه ثبت‌نام بروید
2. نام و نام خانوادگی را وارد کنید
3. ایمیل معتبر را در فیلد ایمیل وارد کنید
4. رمز عبور قوی (حداقل 8 کاراکتر) انتخاب کنید
5. رمز عبور را تکرار کنید
6. دکمه ثبت‌نام را کلیک کنید
7. ایمیل تایید را بررسی کنید"""
    elif "انتقال" in title:
        return """1. وارد حساب کاربری شوید
2. به بخش انتقال وجه بروید
3. شماره حساب مقصد را وارد کنید
4. مبلغ انتقال را مشخص کنید
5. توضیحات انتقال را وارد کنید (اختیاری)
6. دکمه تایید را کلیک کنید
7. کد تایید ارسال شده را وارد کنید
8. وضعیت نهایی انتقال را بررسی کنید"""
    elif "پرداخت" in title:
        return """1. سبد خرید را بررسی و تایید کنید
2. دکمه ادامه به پرداخت را کلیک کنید
3. اطلاعات کارت بانکی را وارد کنید
4. CVV2 و تاریخ انقضا را وارد کنید
5. رمز پویا یا رمز اینترنتی را وارد کنید
6. دکمه پرداخت را کلیک کنید
7. رسید پرداخت را ذخیره کنید"""
    elif "سبد خرید" in title or "افزودن محصول" in title:
        return """1. به صفحه محصول یا دسته‌بندی بروید
2. محصول مورد نظر را پیدا کنید
3. دکمه افزودن به سبد خرید را کلیک کنید
4. تعداد محصول را مشخص کنید
5. به سبد خرید بروید
6. محصول در سبد خرید را بررسی کنید"""
    elif "نمره" in title:
        return """1. به صفحه مدیریت نمرات بروید
2. دانش‌آموز مورد نظر را انتخاب کنید
3. درس مربوطه را انتخاب کنید
4. نمره را در فیلد مربوطه وارد کنید
5. دکمه ذخیره را کلیک کنید
6. ثبت نمره را تایید کنید"""
    elif "کلاس" in title:
        return """1. به صفحه مدیریت کلاس‌ها بروید
2. دانش‌آموز مورد نظر را انتخاب کنید
3. کلاس مقصد را انتخاب کنید
4. دکمه تخصیص را کلیک کنید
5. تایید نهایی را انجام دهید
6. لیست کلاس را بررسی کنید"""
    else:
        return f"""1. سناریوی تست '{title}' را آماده کنید
2. داده‌های ورودی مورد نیاز را فراهم کنید
3. عملیات تست را طبق سناریو انجام دهید
4. نتایج را مشاهده و ثبت کنید
5. نتایج را با انتظارات مقایسه کنید
6. نتیجه نهایی را ثبت کنید"""


def generate_persian_expected_result(title):
    """Generate realistic Persian expected result based on test title"""
    if "ورود موفق" in title:
        return "کاربر با موفقیت وارد سیستم شده، به صفحه داشبورد هدایت می‌شود و اطلاعات کاربری نمایش داده می‌شود"
    elif "ورود ناموفق" in title:
        return "پیام خطای مناسب نمایش داده می‌شود، کاربر وارد سیستم نمی‌شود و در صفحه ورود باقی می‌ماند"
    elif "احراز هویت دو مرحله‌ای" in title:
        return "احراز هویت دو مرحله‌ای با موفقیت فعال شده و تاییدیه نمایش داده می‌شود"
    elif "کد OTP" in title:
        return "با کد OTP صحیح، کاربر با موفقیت وارد سیستم می‌شود و به داشبورد هدایت می‌شود"
    elif "کد OTP منقضی" in title:
        return "پیام خطای منقضی شدن کد OTP نمایش داده می‌شود و کاربر وارد نمی‌شود"
    elif "ثبت‌نام موفق" in title:
        return "حساب کاربری جدید ایجاد شده، ایمیل تایید ارسال می‌شود و کاربر به صفحه تایید هدایت می‌شود"
    elif "ثبت‌نام ناموفق" in title:
        return "پیام خطای مناسب (ایمیل تکراری یا اطلاعات نادرست) نمایش داده می‌شود"
    elif "انتقال موفق" in title:
        return "مبلغ با موفقیت از حساب مبدا کسر و به حساب مقصد واریز می‌شود، رسید انتقال نمایش داده می‌شود"
    elif "انتقال ناموفق" in title:
        return "پیام خطای مناسب (موجودی ناکافی یا اطلاعات نادرست) نمایش داده می‌شود و انتقال انجام نمی‌شود"
    elif "پرداخت موفق" in title:
        return "تراکنش با موفقیت انجام شده، رسید پرداخت نمایش داده می‌شود و سفارش تایید می‌شود"
    elif "پرداخت ناموفق" in title:
        return "پیام خطای مناسب نمایش داده می‌شود و کاربر به صفحه پرداخت باز می‌گردد"
    elif "سبد خرید" in title or "افزودن محصول" in title:
        return "محصول با موفقیت به سبد خرید اضافه شده و تعداد به‌روزرسانی می‌شود"
    elif "نمره" in title:
        return "نمره با موفقیت ثبت شده و در کارنامه دانش‌آموز نمایش داده می‌شود"
    elif "کلاس" in title:
        return "دانش‌آموز با موفقیت به کلاس تخصیص داده شده و لیست کلاس به‌روزرسانی می‌شود"
    else:
        return f"عملیات '{title}' با موفقیت انجام شده و نتایج مورد انتظار حاصل شده است"


def seed_persian_data():
    """Seed database with Persian test data"""
    db = SessionLocal()
    
    try:
        # Get the demo user
        user = db.query(User).filter(User.email == "demo@testmona.com").first()
        if not user:
            print("Demo user not found. Please run seed_data.py first.")
            return
        
        # Persian projects data
        persian_projects = [
            {
                "name": "پروژه مدیریت بانکداری",
                "description": "سیستم جامع مدیریت بانکداری آنلاین با قابلیت‌های پیشرفته",
                "test_suites": [
                    {
                        "name": "مجموعه تست احراز هویت",
                        "description": "تست‌های مربوط به سیستم ورود و ثبت‌نام کاربران",
                        "sections": [
                            {
                                "name": "تست‌های ورود کاربر",
                                "description": "سناریوهای مختلف ورود به سیستم",
                                "subsections": [
                                    {
                                        "name": "ورود با نام کاربری و رمز عبور",
                                        "description": "تست ورود استاندارد",
                                        "test_cases": [
                                            {"title": "ورود موفق با اعتبارنامه صحیح", "test_type": "manual", "priority": "high"},
                                            {"title": "ورود ناموفق با رمز عبور اشتباه", "test_type": "manual", "priority": "high"},
                                            {"title": "ورود ناموفق با نام کاربری نادرست", "test_type": "manual", "priority": "medium"},
                                        ]
                                    },
                                    {
                                        "name": "احراز هویت دو مرحله‌ای",
                                        "description": "تست‌های 2FA",
                                        "test_cases": [
                                            {"title": "فعال‌سازی احراز هویت دو مرحله‌ای", "test_type": "manual", "priority": "high"},
                                            {"title": "ورود با کد OTP صحیح", "test_type": "manual", "priority": "critical"},
                                            {"title": "ورود ناموفق با کد OTP منقضی شده", "test_type": "manual", "priority": "high"},
                                        ]
                                    }
                                ]
                            },
                            {
                                "name": "تست‌های ثبت‌نام",
                                "description": "سناریوهای ثبت‌نام کاربر جدید",
                                "test_cases": [
                                    {"title": "ثبت‌نام موفق با اطلاعات کامل", "test_type": "manual", "priority": "high"},
                                    {"title": "ثبت‌نام ناموفق با ایمیل تکراری", "test_type": "manual", "priority": "medium"},
                                    {"title": "اعتبارسنجی فرمت ایمیل", "test_type": "automated", "priority": "medium"},
                                ]
                            }
                        ]
                    },
                    {
                        "name": "مجموعه تست تراکنش‌ها",
                        "description": "تست‌های مربوط به انتقال وجه و تراکنش‌های مالی",
                        "sections": [
                            {
                                "name": "انتقال وجه داخلی",
                                "description": "انتقال بین حساب‌های داخلی",
                                "subsections": [
                                    {
                                        "name": "انتقال آنی",
                                        "description": "انتقال فوری",
                                        "test_cases": [
                                            {"title": "انتقال موفق با موجودی کافی", "test_type": "automated", "priority": "critical"},
                                            {"title": "انتقال ناموفق با موجودی ناکافی", "test_type": "automated", "priority": "critical"},
                                            {"title": "انتقال با سقف مبلغ روزانه", "test_type": "regression", "priority": "high"},
                                        ]
                                    },
                                    {
                                        "name": "انتقال زمان‌بندی شده",
                                        "description": "انتقال با تاریخ آینده",
                                        "test_cases": [
                                            {"title": "ثبت انتقال برای تاریخ آینده", "test_type": "manual", "priority": "medium"},
                                            {"title": "لغو انتقال زمان‌بندی شده", "test_type": "manual", "priority": "medium"},
                                        ]
                                    }
                                ]
                            },
                            {
                                "name": "انتقال بین بانکی",
                                "description": "ساتنا و پایا",
                                "test_cases": [
                                    {"title": "انتقال ساتنا موفق", "test_type": "integration", "priority": "critical"},
                                    {"title": "انتقال پایا موفق", "test_type": "integration", "priority": "critical"},
                                    {"title": "مدیریت خطای شبکه در انتقال", "test_type": "regression", "priority": "high"},
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "name": "پروژه فروشگاه آنلاین",
                "description": "پلتفرم تجارت الکترونیک با قابلیت‌های کامل",
                "test_suites": [
                    {
                        "name": "مجموعه تست سبد خرید",
                        "description": "تست‌های مربوط به مدیریت سبد خرید",
                        "sections": [
                            {
                                "name": "افزودن محصول",
                                "description": "سناریوهای افزودن کالا به سبد",
                                "test_cases": [
                                    {"title": "افزودن محصول به سبد خرید", "test_type": "manual", "priority": "high"},
                                    {"title": "افزودن چندین محصول یکسان", "test_type": "manual", "priority": "medium"},
                                    {"title": "افزودن محصول با موجودی نامحدود", "test_type": "automated", "priority": "low"},
                                ]
                            },
                            {
                                "name": "مدیریت تعداد",
                                "description": "تغییر تعداد محصولات",
                                "subsections": [
                                    {
                                        "name": "افزایش تعداد",
                                        "description": "افزایش تعداد محصول",
                                        "test_cases": [
                                            {"title": "افزایش تعداد با موجودی کافی", "test_type": "manual", "priority": "medium"},
                                            {"title": "افزایش تعداد بیش از موجودی", "test_type": "manual", "priority": "high"},
                                        ]
                                    },
                                    {
                                        "name": "کاهش تعداد",
                                        "description": "کاهش تعداد محصول",
                                        "test_cases": [
                                            {"title": "کاهش تعداد به یک", "test_type": "manual", "priority": "low"},
                                            {"title": "حذف محصول با کاهش به صفر", "test_type": "manual", "priority": "medium"},
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "name": "مجموعه تست پرداخت",
                        "description": "تست‌های درگاه پرداخت",
                        "sections": [
                            {
                                "name": "پرداخت آنلاین",
                                "description": "تست‌های درگاه‌های پرداخت",
                                "test_cases": [
                                    {"title": "پرداخت موفق با کارت بانکی", "test_type": "integration", "priority": "critical"},
                                    {"title": "پرداخت ناموفق با CVV2 اشتباه", "test_type": "manual", "priority": "high"},
                                    {"title": "تایم‌اوت در پرداخت", "test_type": "performance", "priority": "medium"},
                                ]
                            },
                            {
                                "name": "تست‌های امنیتی پرداخت",
                                "description": "تست‌های امنیت پرداخت",
                                "test_cases": [
                                    {"title": "تست تزریق SQL در فرم پرداخت", "test_type": "security", "priority": "critical"},
                                    {"title": "تست XSS در صفحه پرداخت", "test_type": "security", "priority": "critical"},
                                    {"title": "تست CSRF در درخواست پرداخت", "test_type": "security", "priority": "high"},
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "name": "پروژه سیستم مدیریت آموزش",
                "description": "سیستم مدیریت آموزشی برای مدارس و دانشگاه‌ها",
                "test_suites": [
                    {
                        "name": "مجموعه تست دانش‌آموزان",
                        "description": "مدیریت اطلاعات دانش‌آموزان",
                        "sections": [
                            {
                                "name": "ثبت‌نام دانش‌آموز",
                                "description": "سناریوهای ثبت‌نام",
                                "test_cases": [
                                    {"title": "ثبت‌نام دانش‌آموز جدید", "test_type": "manual", "priority": "high"},
                                    {"title": "ثبت‌نام با کد ملی تکراری", "test_type": "manual", "priority": "high"},
                                    {"title": "اعتبارسنجی سن دانش‌آموز", "test_type": "automated", "priority": "medium"},
                                ]
                            },
                            {
                                "name": "مدیریت کلاس‌ها",
                                "description": "تخصیص دانش‌آموز به کلاس",
                                "subsections": [
                                    {
                                        "name": "تخصیص به کلاس",
                                        "description": "اضافه کردن به کلاس",
                                        "test_cases": [
                                            {"title": "تخصیص دانش‌آموز به کلاس", "test_type": "manual", "priority": "medium"},
                                            {"title": "تخصیص به کلاس ظرفیت‌دار", "test_type": "manual", "priority": "high"},
                                        ]
                                    },
                                    {
                                        "name": "انتقال بین کلاس‌ها",
                                        "description": "تغییر کلاس دانش‌آموز",
                                        "test_cases": [
                                            {"title": "انتقال دانش‌آموز به کلاس دیگر", "test_type": "manual", "priority": "medium"},
                                            {"title": "انتقال در وسط ترم", "test_type": "manual", "priority": "high"},
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "name": "مجموعه تست نمرات",
                        "description": "مدیریت نمرات و کارنامه",
                        "sections": [
                            {
                                "name": "ثبت نمره",
                                "description": "وارد کردن نمرات",
                                "test_cases": [
                                    {"title": "ثبت نمره عادی", "test_type": "manual", "priority": "medium"},
                                    {"title": "ثبت نمره خارج از بازه 0-20", "test_type": "automated", "priority": "high"},
                                    {"title": "ثبت نمره منفی", "test_type": "automated", "priority": "medium"},
                                ]
                            },
                            {
                                "name": "محاسبه میانگین",
                                "description": "محاسبه معدل",
                                "test_cases": [
                                    {"title": "محاسبه میانگین ساده", "test_type": "automated", "priority": "low"},
                                    {"title": "محاسبه میانگین وزنی", "test_type": "automated", "priority": "medium"},
                                    {"title": "محاسبه رتبه دانش‌آموز", "test_type": "automated", "priority": "medium"},
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        
        # Create projects, test suites, sections, and test cases
        for project_data in persian_projects:
            # Check if project already exists
            existing_project = db.query(Project).filter(Project.name == project_data["name"]).first()
            if existing_project:
                print(f"Project '{project_data['name']}' already exists. Skipping.")
                continue
            
            # Create project
            project = Project(
                name=project_data["name"],
                description=project_data["description"],
                owner_id=user.id,
                status=Status.ACTIVE
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            print(f"Created project: {project.name}")
            
            # Create test suites
            for suite_data in project_data["test_suites"]:
                test_suite = TestSuite(
                    name=suite_data["name"],
                    description=suite_data["description"],
                    project_id=project.id,
                    status=Status.ACTIVE
                )
                db.add(test_suite)
                db.commit()
                db.refresh(test_suite)
                print(f"  Created test suite: {test_suite.name}")
                
                # Create sections
                for section_data in suite_data["sections"]:
                    section = TestCaseSection(
                        name=section_data["name"],
                        description=section_data.get("description", ""),
                        test_suite_id=test_suite.id,
                        order_index=0,
                        is_active=True
                    )
                    db.add(section)
                    db.commit()
                    db.refresh(section)
                    print(f"    Created section: {section.name}")
                    
                    # Create subsections if any
                    if "subsections" in section_data:
                        for subsection_data in section_data["subsections"]:
                            subsection = TestCaseSection(
                                name=subsection_data["name"],
                                description=subsection_data.get("description", ""),
                                test_suite_id=test_suite.id,
                                parent_section_id=section.id,
                                order_index=0,
                                is_active=True
                            )
                            db.add(subsection)
                            db.commit()
                            db.refresh(subsection)
                            print(f"      Created subsection: {subsection.name}")
                            
                            # Create test cases for subsection
                            if "test_cases" in subsection_data:
                                for tc_data in subsection_data["test_cases"]:
                                    # Generate more realistic Persian content based on test type
                                    test_case = TestCase(
                                        title=tc_data["title"],
                                        description=generate_persian_description(tc_data["test_type"]),
                                        test_type=tc_data["test_type"],
                                        preconditions=generate_persian_preconditions(tc_data["title"]),
                                        steps=generate_persian_steps(tc_data["title"], tc_data["test_type"]),
                                        expected_result=generate_persian_expected_result(tc_data["title"]),
                                        priority=tc_data.get("priority", "medium"),
                                        status="active",
                                        test_suite_id=test_suite.id,
                                        section_id=subsection.id,
                                        created_by=user.id,
                                        is_multistep=False
                                    )
                                    db.add(test_case)
                                    db.commit()
                                    print(f"        Created test case: {test_case.title} ({test_case.test_type})")
                    
                    # Create test cases for section if no subsections
                    if "test_cases" in section_data and "subsections" not in section_data:
                        for tc_data in section_data["test_cases"]:
                            test_case = TestCase(
                                title=tc_data["title"],
                                description=generate_persian_description(tc_data["test_type"]),
                                test_type=tc_data["test_type"],
                                preconditions=generate_persian_preconditions(tc_data["title"]),
                                steps=generate_persian_steps(tc_data["title"], tc_data["test_type"]),
                                expected_result=generate_persian_expected_result(tc_data["title"]),
                                priority=tc_data.get("priority", "medium"),
                                status="active",
                                test_suite_id=test_suite.id,
                                section_id=section.id,
                                created_by=user.id,
                                is_multistep=False
                            )
                            db.add(test_case)
                            db.commit()
                            print(f"        Created test case: {test_case.title} ({test_case.test_type})")
        
        print("\n✅ Persian data seeded successfully!")
        
    except Exception as e:
        print(f"❌ Error seeding Persian data: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_persian_data()

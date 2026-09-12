from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, PASSWORD, USER_EMAIL

RESUME_BODY = {
    "name": "我的简历",
    "data": {"profile": {"name": "张三"}, "sections": []},
    "style": {"font": 13.5, "color": "#2b4c7e"},
    "applications": [
        {"id": "a1", "job": "产品实习生", "company": "字节跳动", "companyUrl": "https://jobs.bytedance.com", "url": "", "date": "2026-09-10", "note": ""},
        {"id": "a2", "job": "产品助理", "company": "腾讯", "companyUrl": "", "url": "", "date": "2026-09-11", "note": "内推"},
    ],
}


async def test_register_requires_allowlist(client):
    r = await client.post(
        "/api/v1/auth/register", json={"email": "x@test.dev", "password": PASSWORD}
    )
    assert r.status_code == 403
    assert r.json()["code"] == "not_allowed"


async def test_register_login_and_me(user_client):
    r = await user_client.get("/api/v1/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == USER_EMAIL
    assert body["is_admin"] is False


async def test_login_wrong_password(admin_client):
    r = await admin_client.post(
        "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-pass"}
    )
    assert r.status_code == 401
    assert r.json()["code"] == "bad_credentials"


async def test_duplicate_register(user_client):
    user_client.cookies.clear()
    r = await user_client.post(
        "/api/v1/auth/register", json={"email": "user@test.dev", "password": PASSWORD}
    )
    assert r.status_code == 409


async def test_refresh_rotation_and_replay(user_client):
    old_refresh = user_client.cookies.get("rs_refresh")
    r = await user_client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    new_refresh = user_client.cookies.get("rs_refresh")
    assert new_refresh and new_refresh != old_refresh

    # 重放旧 refresh token → 401，且新链也被撤销
    user_client.cookies.set("rs_refresh", old_refresh)
    assert (await user_client.post("/api/v1/auth/refresh")).status_code == 401
    user_client.cookies.set("rs_refresh", new_refresh)
    assert (await user_client.post("/api/v1/auth/refresh")).status_code == 401


async def test_logout_revokes(user_client):
    refresh = user_client.cookies.get("rs_refresh")
    assert (await user_client.post("/api/v1/auth/logout")).status_code == 204
    user_client.cookies.set("rs_refresh", refresh)
    assert (await user_client.post("/api/v1/auth/refresh")).status_code == 401


async def test_resume_crud_and_revision(user_client):
    created = (await user_client.post("/api/v1/resumes", json=RESUME_BODY)).json()
    rid = created["id"]
    assert created["revision"] == 1
    assert created["applications"][0]["job"] == "产品实习生"

    body = {**RESUME_BODY, "revision": 1, "name": "v2"}
    updated = (await user_client.put(f"/api/v1/resumes/{rid}", json=body)).json()
    assert updated["revision"] == 2 and updated["name"] == "v2"

    stale = await user_client.put(f"/api/v1/resumes/{rid}", json=body)
    assert stale.status_code == 409
    assert stale.json()["detail"]["revision"] == 2

    summaries = (await user_client.get("/api/v1/resumes")).json()
    assert len(summaries) == 1 and summaries[0]["id"] == rid

    assert (await user_client.delete(f"/api/v1/resumes/{rid}")).status_code == 204
    assert (await user_client.get(f"/api/v1/resumes/{rid}")).status_code == 404


async def test_resume_isolation(admin_client, user_client):
    rid = (await user_client.post("/api/v1/resumes", json=RESUME_BODY)).json()["id"]
    admin_client.cookies.clear()
    await admin_client.post(
        "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "admin-secret-1"}
    )
    assert (await admin_client.get(f"/api/v1/resumes/{rid}")).status_code == 404


async def test_ui_state(user_client):
    state = {"order": ["a", "b"], "currentId": "a"}
    r = await user_client.put("/api/v1/me/state", json=state)
    assert r.status_code == 200 and r.json()["ui_state"] == state


async def test_admin_endpoints_require_admin(user_client):
    assert (await user_client.get("/api/v1/admin/users")).status_code == 403


async def test_admin_user_management(admin_client, user_client, client):
    uid = (await user_client.get("/api/v1/me")).json()["id"]

    # 停用后存量 access token 立即失效
    r = await admin_client.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False})
    assert r.status_code == 200
    assert (await user_client.get("/api/v1/me")).status_code == 401

    assert (await admin_client.delete(f"/api/v1/admin/users/{uid}")).status_code == 204
    users = [u["id"] for u in (await admin_client.get("/api/v1/admin/users")).json()]
    assert uid not in users
    # 删除用户连同白名单一起移除，被删邮箱不可凭残留许可重新注册
    allow = [a["email"] for a in (await admin_client.get("/api/v1/admin/allowlist")).json()]
    assert USER_EMAIL not in allow
    assert (await client.post("/api/v1/auth/register", json={"email": USER_EMAIL, "password": "passw0rd123"})).status_code == 403


async def test_admin_self_protection(admin_client):
    me = (await admin_client.get("/api/v1/me")).json()
    r = await admin_client.patch(f"/api/v1/admin/users/{me['id']}", json={"is_active": False})
    assert r.status_code == 400
    assert (await admin_client.delete(f"/api/v1/admin/users/{me['id']}")).status_code == 400


async def test_admin_export_user_data(admin_client, user_client):
    await user_client.post("/api/v1/resumes", json=RESUME_BODY)
    uid = (await user_client.get("/api/v1/me")).json()["id"]

    r = await admin_client.get(f"/api/v1/admin/users/{uid}/export")
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == USER_EMAIL
    assert body["user"]["is_admin"] is False
    assert "password_hash" not in body["user"]
    assert len(body["resumes"]) == 1
    apps = body["resumes"][0]["applications"]
    assert len(apps) == 2 and apps[0]["company"] == "字节跳动"

    # 普通用户无权访问；不存在的用户 404
    assert (await user_client.get(f"/api/v1/admin/users/{uid}/export")).status_code == 403
    assert (await admin_client.get("/api/v1/admin/users/9999/export")).status_code == 404


async def test_admin_export_user_applications(admin_client, user_client):
    await user_client.post("/api/v1/resumes", json=RESUME_BODY)
    uid = (await user_client.get("/api/v1/me")).json()["id"]

    rows = (await admin_client.get(f"/api/v1/admin/users/{uid}/applications")).json()
    assert len(rows) == 2
    # 按日期倒序
    assert rows[0]["job"] == "产品助理" and rows[0]["company"] == "腾讯"
    assert rows[0]["resume_name"] == "我的简历"
    assert rows[1]["company_url"] == "https://jobs.bytedance.com"

    # 公司名筛选（包含匹配）
    rows = (await admin_client.get(f"/api/v1/admin/users/{uid}/applications?company=字节")).json()
    assert len(rows) == 1 and rows[0]["job"] == "产品实习生"
    rows = (await admin_client.get(f"/api/v1/admin/users/{uid}/applications?company=不存在")).json()
    assert rows == []

    assert (await user_client.get(f"/api/v1/admin/users/{uid}/applications")).status_code == 403
    assert (await admin_client.get("/api/v1/admin/users/9999/applications")).status_code == 404


async def test_remove_from_allowlist_deactivates(admin_client, user_client):
    r = await admin_client.delete(f"/api/v1/admin/allowlist/{USER_EMAIL}")
    assert r.status_code == 204
    assert (await user_client.get("/api/v1/me")).status_code == 401
    assert (await admin_client.delete(f"/api/v1/admin/allowlist/{USER_EMAIL}")).status_code == 404

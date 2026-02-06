import { NextResponse } from "next/server";

export function buildRedirectUrl(
  request: Request,
  pathname: string,
  params: Record<string, string | undefined>
): URL {
  const redirectUrl = new URL(pathname, request.url);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  });

  return redirectUrl;
}

export function redirectTo(
  request: Request,
  pathname: string,
  params: Record<string, string | undefined> = {}
) {
  return NextResponse.redirect(buildRedirectUrl(request, pathname, params), {
    status: 303
  });
}

$p = "C:\\systems\\robotograhv2-vercel\\src\\app\\x7k2\\dashboard\\page.tsx"
$s = Get-Content $p -Raw
$start = '{tab === "audit" && ('
$sidx = $s.IndexOf($start)
if ($sidx -ge 0) {
    $endFn = "function NotConfigured"
    $eidx = $s.IndexOf($endFn, $sidx)
    if ($eidx -gt 0) {
        $block = @"
{tab === "audit" && (
            <>
              <div className="admin-page-heading">
                <p className="eyebrow">SECURITY</p>
                <h1>Audit log</h1>
                <p className="heading-sub">All INSERT, UPDATE, DELETE, and SMS operations recorded by the system.</p>
              </div>
              {!supaCfg ? <NotConfigured /> : <AuditPanel />}
            </>
          )}
"@
        $s = $s.Substring(0, $sidx) + $block + $s.Substring($eidx)
    }
}
Set-Content $p -Value $s -NoNewline

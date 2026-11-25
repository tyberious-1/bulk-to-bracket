function jxaPrint(s) {
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $.NSString.alloc.initWithUTF8String(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding)
  );
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((message || "assertEqual failed") + ": expected " + e + " but got " + a);
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((message || "assertClose failed") + ": expected ~" + expected + " (tolerance " + tolerance + ") but got " + actual);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message || "assertTrue failed");
}

function runSuite(name, tests) {
  let passed = 0;
  let failed = 0;
  for (const testName of Object.keys(tests)) {
    try {
      tests[testName]();
      passed += 1;
      jxaPrint("PASS " + name + " > " + testName);
    } catch (err) {
      failed += 1;
      jxaPrint("FAIL " + name + " > " + testName + ": " + err.message);
    }
  }
  jxaPrint(name + ": " + passed + " passed, " + failed + " failed");
  jxaPrint(failed > 0 ? "SUITE FAILED" : "SUITE OK");
}

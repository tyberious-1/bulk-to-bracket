runSuite("smoke", {
  "true is true": function () {
    assertTrue(true, "should be true");
  },
  "1 plus 1": function () {
    assertEqual(1 + 1, 2);
  },
  "assertClose tolerates small drift": function () {
    assertClose(1.001, 1, 0.01);
  }
});

module tb;
  reg signed [7:0] a, b; reg signed [15:0] p; reg [7:0] u; wire signed [8:0] s;
  assign s = a + b;
  initial begin
    a = -100; b = 50; #1 $display("%d %d %d", a, b, s);
    p = a * b; $display("%d", p);
    a = 8'sb1000_0000; $display("%d %d %d", a, -a, a >>> 3);
    u = 8'hF0; $display("%d %d", $signed(u), $signed(u) >>> 2);
    $display("%d %d", a < 0, $unsigned(a) < 0);
    b = -3; $display("%d %d %d", a / b, -7 % 3, 7 % -3);
    $display("%d", 4'sd7 + 4'sd1);
    $display("%b", {4{1'b1}} & 8'b1010_1010);
    $display("%h", -1);
    $finish;
  end
endmodule

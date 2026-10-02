module tb;
  reg [7:0] a, b; reg signed [7:0] sa, sb; reg [3:0] n; integer i;
  reg [15:0] wide; wire [7:0] w;
  initial begin
    a = 8'd200; b = 8'd100; sa = -8'sd5; sb = 8'sd3;
    $display("%d %d %d %d %d", a + b, a - b, a * b, a / 7, a % 7);
    $display("%b %b %b %b", a & b, a | b, a ^ b, ~a);
    $display("%b %b %b %b %b %b", &a, |a, ^a, ~&a, ~|a, ~^a);
    $display("%d %d %d %d", a < b, a >= b, a == 200, a != b);
    $display("%d %d %d", sa < sb, sa >>> 1, sa >> 1);
    $display("%d %d %d", sa * sb, sa / sb, sa + sb);
    $display("%b %b", {a[3:0], b[7:4]}, {2{a[1:0]}});
    $display("%h %h", a << 3, {8'h00, a} << 3);
    wide = a * b; $display("%d", wide);
    n = 4'bx01z; $display("%b %d %h", n, n, n);
    $display("%b %b", n & 4'b0000, n | 4'b1111);
    $display("%d %d", 1'bx == 1'b1, 1'bx === 1'bx);
    i = -7; $display("%d %0d %b", i, i, i[3:0]);
    $display("%d", 3'd5 > 3'd2 ? 8'd10 : 8'd20);
    $display("%d %d", -4'd3, 4'd3 - 4'd5);
    $display("%h", 32'hdead_beef >> 4);
    $finish;
  end
endmodule

module tb;
  reg [3:0] a = 1, b = 2; reg clk = 0;
  always @(posedge clk) begin a <= b; b <= a; end
  reg [3:0] c, d;
  always @(posedge clk) begin c = a; d = c; end
  initial begin
    $display("start a=%0d b=%0d", a, b);
    repeat (3) begin #5 clk = 1; #5 clk = 0; $display("a=%0d b=%0d c=%0d d=%0d", a, b, c, d); end
    $finish;
  end
endmodule

module clkdiv #(parameter DIV = 6)(input clk, rst, output reg out);
  reg [7:0] cnt;
  always @(posedge clk or posedge rst)
    if (rst) begin cnt <= 0; out <= 0; end
    else if (cnt == DIV/2 - 1) begin cnt <= 0; out <= ~out; end
    else cnt <= cnt + 1;
endmodule
module pwm(input clk, input [3:0] duty, output pwm_out);
  reg [3:0] ramp = 0;
  always @(posedge clk) ramp <= ramp + 1;
  assign pwm_out = ramp < duty;
endmodule
module tb;
  reg clk = 0, rst = 1; wire slow, p;
  clkdiv #(6) d(clk, rst, slow);
  pwm m(clk, 4'd5, p);
  always #1 clk = ~clk;
  integer highs = 0, k;
  initial begin
    #3 rst = 0;
    for (k = 0; k < 64; k = k + 1) begin @(posedge clk); highs = highs + p; end
    $display("pwm high %0d of 64 cycles", highs);
    $display("slow=%b at %0t", slow, $time);
    $finish;
  end
  always @(posedge slow) $display("slow rises at %0t", $time);
endmodule

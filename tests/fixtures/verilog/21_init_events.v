module tb;
  reg a = 0; reg r = 1; reg [3:0] q;
  always @(a) $display("%0t level a event a=%b", $time, a);
  always @(posedge r) $display("%0t posedge r", $time);
  always @(r) $display("%0t any r", $time);
  initial #1 $display("done");
endmodule

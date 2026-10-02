module tb;
  reg clk = 0; reg [7:0] sr = 8'b1; reg [3:0] cnt = 0; wire tick = (cnt == 4'd9);
  always #3 clk = !clk;
  always @(posedge clk) begin cnt <= tick ? 0 : cnt + 1; if (tick) sr <= {sr[6:0], sr[7]}; end
  initial begin #200; $display("sr=%b cnt=%d", sr, cnt); end
  initial begin $monitor("%0t: sr=%b", $time, sr); #250 $finish; end
endmodule
